import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result, GeospatialForm, DependentResultFile } from "./../api/types"
import expr from 'expr-eval';
import fs from 'fs';
import { logger } from "../api/logger";
import JSONstream from 'jsonstream';
//import CombinedStream from 'combined-stream';

// Aggregates spatial data based on a configured equation
@IVariableMethod.register
export class AggregateVariableMethod {

    private expression : expr.Expression;
    private dependencies : string[];

    constructor(deps:string[],conf:any) {
        logger.info("Aggregate started with " + JSON.stringify(conf));
        this.expression = validateExpression(conf);
        this.dependencies = deps;
    }

    availableOutputTypes() {
        return [ "json" ];
    }

    spatialDimension() {
        let boundingBox = [
            { Latitude: 90, Longitude: -180 },
            { Latitude: -90, Longitude: -180 },
            { Latitude: -90, Longitude: 180 },
            { Latitude: 90, Longitude: 180 },
            { Latitude: 90, Longitude: -180 }
        ]
        return boundingBox;
    }

    temporalDimension() : TemporalDimension {
        let slices : SlicedTime = {
            kind: "timeSlice",
            slices: []
        }
        return (slices);
    }

    availableForDate() { return true; }

    availableForSpace() { return true; }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,dependencies:DependentResultFile[],options:any) : Promise<Result<GeospatialForm, string>> {
        logger.info("Aggregating");
        return await aggregate(this.expression, this.dependencies, dependencies, outputDir);
    }
}

const validateExpression = (config:any) => {
    if (config.equation == null) throw Error("[equation] You must define an operation to aggregate by");
    if (typeof config.equation != "string") throw Error("[equation] The equation must be defined using a string");
    const parser = new expr.Parser();
    try {
        logger.info("Parsing " + config.equation);
        const expression = parser.parse(config.equation);
        return expression;
    } catch {
        throw Error("[equation] The specified equation was not valid");
    }
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

function getFromJsonFile<T> (path: fs.PathLike, pattern: any[]) : Promise<T> {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(path, { encoding: 'utf8' });
        const dataParser = JSONstream.parse(pattern);
        stream.pipe(dataParser);
        dataParser.on("data", d => { resolve(d as T); });
    });
}

const getMax = (a: number[][]) : number => {
    return Math.max(...a.map(e => Math.max(...e.filter(i => !isNaN(i)))));
}

const getMin = (a: number[][]) : number => {
    return Math.min(...a.map(e => Math.min(...e.filter(i => !isNaN(i)))));
}

const stdDev = (x: number[][]) => { 
    const x2 : number[] = x.reduce( function(a, b) { return a.concat(b); }, [] ).filter(i => !isNaN(i));
    return x2.reduce(function (a, x, i) {
        var n = i + 1,
        sum_ = a.sum + x,
        squaresSum_ = a.squaresSum + (x * x);
        return {
            sum: sum_,
            squaresSum: squaresSum_,
            result: Math.sqrt((squaresSum_ / n) - Math.pow((sum_ / n), 2))        };
    }, {
        sum: 0,
        squaresSum: 0,
        result: 0
    }).result
};

const average = (x: number[][]) => {
    const y = new Array<number>().concat(...x);
    return y.reduce( function(a, b) { return a + b; }, 0 ) / y.length;
}


const aggregate = async (expression:expr.Expression, required:string[], dependencyFiles:DependentResultFile[], outputFileTemplate:string) : Promise<Result<GeospatialForm,string>> => {

    // 1. Check that all required dependencies are here and valid.
    logger.info("Aggregating: " + JSON.stringify(required));
    const dependencies = required.map(r => {
        return dependencyFiles.find(d => d.Name == r);
    }).filter(notEmpty);
    if (dependencies.length != required.length) {
        return { kind: "failure", message: "Some dependencies were not present. Required: " + JSON.stringify(required) };
    }

    // 2. Ensure all dependencies have equal columns and rows, and same spatial extent.
    const dims = await Promise.all(dependencies.map(async d => {
        const cols = await getFromJsonFile<number>(d.Filename, ["data", "ncols"]);
        const rows = await getFromJsonFile<number>(d.Filename, ["data", "nrows"]);
        const dimension = await getFromJsonFile(d.Filename, ['dimensions']);
        return { Cols: cols, Rows: rows, Dimensions: dimension };
    }));
    if (!dims.every( v => v.Cols === dims[0].Cols && v.Rows === dims[0].Rows )) {
        return { kind: "failure", message: "All dimensions must be equal for this aggregator: " + JSON.stringify(dims[0]) };
    }

    // 3. Run through all dependencies and run an equation
    logger.info("All dependencies have the same dimensions");
    // TODO Figure out better memory use strategy here (combine pipes?)
    const rows = dims[0].Rows;
    const cols = dims[0].Cols;
    let output = new Array<expr.Expression[]>();
    for (let y = 0; y < rows; y++) {
        output[y] = new Array<expr.Expression>();
        for (let x = 0; x < cols; x++) {
            output[y][x] = expression;
        }
    }

    // Process expression with each dependency
    for (let i = 0; i < dependencies.length; i++) {
        const d = dependencies[i];
        logger.info("Simplifying expression with data: " + d.Name);
        const summary = await getFromJsonFile(d.Filename, ['summary']) as any;
        const data = await getFromJsonFile<number[][]>(d.Filename, ['data', 'raw']);
        for (let iy = 0; iy < data.length; iy++) {
            const row = data[iy];
            for (let ix = 0; ix < row.length; ix++) {
                let newVars : any = {};
                newVars[d.Name] = row[ix] == null ? NaN : row[ix];
                newVars[d.Name + "_mean"] = summary.Mean == null ? NaN : summary.Mean;
                newVars[d.Name + "_stdev"] = summary.StDev == null ? NaN : summary.StDev;
                output[iy][ix] = output[iy][ix].simplify(newVars);
            }
        }
    }

    logger.info("Evaluating fully-parameterised equation");
    const outputCube = output.map(r => r.map(x => x.evaluate() as number));

    logger.info("Calculating summary statistics");
    const outputJson = {
        dimensions: dims[0].Dimensions,
        summary: {
            Mean: average(outputCube),
            Maximum: getMax(outputCube),
            Minimum: getMin(outputCube),
            StDev: stdDev(outputCube)
        },
        data: {
            ncols: cols,
            nrows: rows,
            raw: outputCube.map(r => r.map(x => x == null ? NaN : x))
        }
    };

    logger.info("Caching computed equation data to file");
    const outputFile = outputFileTemplate + "_output.json";
    fs.writeFileSync(outputFile, JSON.stringify(outputJson));
    return { kind: "ok", result: GeospatialForm.Raster };    

    //const outputStream = fs.createWriteStream(outputFileTemplate + "_output.json");
    //const combined = new CombinedStream();
    //dependencies.map(d => { combined.append(fs.createReadStream(d.Filename).pipe(JSONstream.parse(['summary', 'data', 'raw']))); });
}
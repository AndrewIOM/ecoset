import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from '../logger';
import { EcosetJobRequest, PointWGS84, TemporalDimension, IVariableMethod, Result, JobState, GeospatialForm, DependentResultFile } from "../types";
import { listVariables, getDependencies } from "../registry";
import { tryEstablishCache } from "../output-cache";
import { redisStateCache, stateCache } from '../state-cache';
import { SandboxedJob } from 'bullmq';
import { LeveledLogMethod } from 'winston';

const variables = listVariables();

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

type VariableToRun = {
    Name: string
    Method: {
        Id: string;
        Name: string;
        License: string;
        LicenseUrl: string;
        Imp: IVariableMethod;
    }
    Options: Map<string,any>
}

type Node = {
    Variable: VariableToRun,
    Dependencies: Node[]
}

// Returns a jagged array of the running heirarchy of a particular plugin.
const getNodeTree = (variable:VariableToRun, variablesToRun:VariableToRun[]) : Node => {
    const dependencies = getDependencies(variable.Name, variable.Method.Id);
    if (dependencies.length > 0) {
        const node =
            dependencies
            .map(d => variablesToRun.find(v => v.Name == d))
            .filter(notEmpty)
            .map(d => getNodeTree(d, variablesToRun));
        return { Variable: variable, Dependencies: node };
    }
    return { Variable: variable, Dependencies: []};
}

const kahn = (nodes:Node[]) => {
    let L = Array<Node>();
    let S = nodes.filter(n => n.Dependencies.length == 0);

    let graph = nodes;
    while (S.length > 0) {
        let n = S.pop() as Node;
        L.push(n);
        for (let index = 0; index < graph.length; index++) {
            // For each (node m with edge e from n to m) do
            if (graph[index].Dependencies.filter(m => m.Variable.Name == n.Variable.Name).length > 0) {
                // Remove edge mathed from graph.
                graph[index] = { Variable: graph[index].Variable, Dependencies: graph[index].Dependencies.filter(x => x.Variable.Name !== n.Variable.Name) };
                
                if (graph[index].Dependencies.length == 0) {
                    S.push(graph[index]);
                }
            }
        }
    }

    if (graph.filter(m => m.Dependencies.length > 0).length > 0) {
        throw "Dependency tree has at least one circularity.";
    }
    return L;
}

const writeData = (fileReader:readline.Interface, finalOutputFile:string) => {
    return new Promise<void>(resolve => {
        fileReader.on('line', function(line) {
            fs.appendFileSync(finalOutputFile, line);
        }).on("close", () => {
            return resolve();
        });
    });
}

type UpdatePercent = (i:number) => void;
interface ProcessingResult { Name: string; Result: Result<GeospatialForm, string>};

const promiseMap = (inputValues: Node[], mapper:((n:Node) => Promise<ProcessingResult>)) => {
    const reducer = (acc$: Promise<ProcessingResult[]>, inputValue: Node) =>
        acc$.then(acc => mapper(inputValue).then(result => { acc.push(result); return acc }));
    return inputValues.reduce(reducer, Promise.resolve([]));
}

const processJob = async (job:EcosetJobRequest, jobId:string, updatePercent:UpdatePercent, log: ((arg0: LeveledLogMethod, arg1: string) => void)) : Promise<Result<void,string>> => {

    log(logger.info, "Starting processing of analysis: " + JSON.stringify(job));
    await redisStateCache.setState(stateCache, jobId, JobState.Processing);

    const cacheDir = tryEstablishCache(jobId.toString());
    if (cacheDir == null) {
        return { kind: "failure", message: "Cache directory does not exist" };
    }

    const variablesToRun = 
        job.Variables.map(vto => {
            const v = variables.find(variable => variable.Id == vto.Name);
            if (v !== undefined) {
                const m = v.Methods.find(method => method?.Id == vto.Method);
                if (m == undefined) return null;
                return { Name: vto.Name, Method: m, Options: vto.Options };
            }
            return null;
        }).filter(notEmpty);
    
    if (variablesToRun.length == 0) {
        return { kind: "failure", message: "None of the specified variables existed, or request contained no variables" };
    }

    const boundingBox : PointWGS84[] = [
        { Latitude: job.LatitudeNorth, Longitude: job.LongitudeWest },
        { Latitude: job.LatitudeSouth, Longitude: job.LongitudeWest },
        { Latitude: job.LatitudeSouth, Longitude: job.LongitudeEast },
        { Latitude: job.LatitudeNorth, Longitude: job.LongitudeEast },
        { Latitude: job.LatitudeNorth, Longitude: job.LongitudeWest }
    ]

    const nodes = variablesToRun.map(v => getNodeTree(v, variablesToRun));
    const orderedNodes = kahn(nodes);

    // TODO Group nodes into levels to run using Promise.All
    // Currently running in order sequentially.
    let completeCount = 0;
    let completeFiles = new Array<DependentResultFile>()
    const processThing = async (node:Node) : Promise<ProcessingResult> => {
        const fileTemplate = cacheDir + node.Variable.Name + "_" + node.Variable.Method.Id;
        const v = await node.Variable.Method.Imp.computeToFile(boundingBox, job.TimeMode, fileTemplate, completeFiles, node.Variable.Options);
        completeFiles.push({Filename: fileTemplate + "_output.json", Name: node.Variable.Name, Method: node.Variable.Method.Id } );
        completeCount ++;
        updatePercent(Math.round((completeCount / orderedNodes.length) * 100));
        return { Name: node.Variable.Name, Result: v };
    }

    const results = await promiseMap(orderedNodes, processThing).catch(e => {
        log(logger.error, "There was a problem running the stated variables and methods. The error was: " + e);
        return undefined;
    })

    if (results == undefined) {
        return { kind: "failure", message: "There was an internal error when running the analysis." };
    }

    const failed = results.filter(r => r.Result.kind == "failure");
    if (failed.length > 0) {
        return { kind: "failure", message: "There was an internal error with your analysis: " + JSON.stringify(failed) };
    }

    log(logger.info, "All workloads complete for analysis: " + jobId);

    // Merge all outputs into a single output (for sending all at once)
    const finalOutputFile = cacheDir + "/output.json";
    fs.writeFileSync(finalOutputFile, "{\"north\": " + job.LatitudeNorth + ",\"south\":" + job.LatitudeSouth + ",\"east\":" + job.LongitudeEast + ",\"west\":" + job.LongitudeWest + ",\"output\":[");

    for (let index = 0; index < variablesToRun.length; index++) {

        let outputFormat = "Unknown";
        const runResult : {
            Name: string;
            Result: Result<GeospatialForm, string>;
        } | undefined = results.find(r => r.Name == variablesToRun[index].Name);
        if (runResult) {
            switch (runResult.Result.kind) {
                case "ok":
                    outputFormat = runResult.Result.result;
                    break;
                case "failure":
                    break;
            }
        }

        const variableResult = path.join(cacheDir, variablesToRun[index].Name + "_" + variablesToRun[index].Method.Id + "_output.json");
        log(logger.debug, "File is: " + variableResult);
        if (!fs.existsSync(variableResult)) {
            log(logger.warn, "file doesn't exist");
            log(logger.warn, "No data in result: " + variablesToRun[index].Name + "; method: " + variablesToRun[index].Method.Id);
            return { kind: "failure", message: "No data in result: " + variablesToRun[index].Name + "; method: " + variablesToRun[index].Method.Id };
        }
        log(logger.info, "Synthesising results: " + variablesToRun[index].Name + " - " + variablesToRun[index].Method.Id);
        fs.appendFileSync(finalOutputFile, "{ \"name\":\""
            + variablesToRun[index].Name + "\",\"method_used\":\"" + variablesToRun[index].Method.Id
            + "\",\"output_format\":\"" + outputFormat + "\",\"data\":");

        const fileReader = readline.createInterface( {input: fs.createReadStream(variableResult) });
        await writeData(fileReader, finalOutputFile);

        if (index < variablesToRun.length - 1) {
            fs.appendFileSync(finalOutputFile, "},");
        } else {
            fs.appendFileSync(finalOutputFile, "}]}");
        }
    }

    log(logger.info, "Removing intermediate cache files..");
    completeFiles.map(f => { try { fs.unlinkSync(f.Filename); } catch(e) {} });

    log(logger.info, "Analysis complete");
    return { kind: "ok", result: undefined };
}

const logToJobThen = (job:SandboxedJob<EcosetJobRequest>) => {
    return (then:LeveledLogMethod, message:string) => {
        job.log(message);
        then(message);
    }
}

export default async function (job:SandboxedJob<EcosetJobRequest>) {
    const result = await processJob(job.data, job.id.toString(), i => job.updateProgress(i), logToJobThen(job));
    switch ((result).kind) {
        case "ok":
            await redisStateCache.setState(stateCache, job.id.toString(), JobState.Ready);
            return null;
        case "failure":
            await redisStateCache.setState(stateCache, job.id.toString(), JobState.Failed);
            throw new Error(result.message);
    }
}
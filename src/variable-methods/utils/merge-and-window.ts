import fs from 'fs';
import readline from 'readline';
import winston, { stream } from 'winston';
import { runCommand } from './run-command';
import { SimpleDate, PointWGS84, Time, Result } from "./../../api/types";
import { timeSlices, temporalMatch } from './time-slices';

type TwoWayMap<A,B> = {
    Forward: (arg:A) => (B | undefined),
    Backward: (arg:B) => (A | undefined)
}

// Create a lookup between tile names and spatial location
const tileLookupTable : () => TwoWayMap<string,string> = () => {
    const csv = fs.readFileSync(__dirname + "/tiles.csv");
    const lines = csv.toString().split("\n");
    const boundsFromName = new Map<string, string>()
    const nameFromBounds = new Map<string, string>()
    lines.forEach(line => {
        const data = line.split(',');
        const name = data[0];
        const coord = [ parseInt(data[1].trim()), 
                        parseInt(data[2].trim()), 
                        parseInt(data[3].trim()), 
                        parseInt(data[4].trim()) ]
        boundsFromName.set(name, coord.toString());
        nameFromBounds.set(coord.toString(), name);
    });
    return {
        Forward: s => boundsFromName.get(s),
        Backward: s => nameFromBounds.get(s)
    };
}

type Bounds = {
    LatMin: number,
    LatMax: number,
    LonMin: number,
    LonMax: number
}

const bufferBounds = (bounds:Bounds,buffer:number) => {
    return {
        LatMin: bounds.LatMin - buffer < -90 ? -90 : bounds.LatMin - buffer,
        LatMax: bounds.LatMax + buffer > 90 ? 90 : bounds.LatMax + buffer,
        LonMin: bounds.LonMin - buffer < -180 ? -180 : bounds.LonMin - buffer,
        LonMax: bounds.LonMax + buffer > 180 ? 180 : bounds.LonMax + buffer
    };
}

const tilesInBounds = (tileLookup:TwoWayMap<string,string>,bounds:Bounds) => {
    let tiles = [];
    for (var x = Math.floor(bounds.LonMin); x < Math.floor(bounds.LonMax); x++) {
        for (var y = Math.floor(bounds.LatMin); y < Math.floor(bounds.LatMax); y++) {
            var tileName = tileLookup.Backward([x, (x + 1), y, (y + 1)].toString());
            if (tileName != undefined)
                tiles.push(tileName);
        }
    }
    return tiles;
}

type Statistic = {
    Minimum: number,
    Maximum: number,
    Mean: number,
    StDev: number
}

const parseGdalInfo : ((o:string) => Statistic) = (output:string) => {
    // Errors may be returned on first line, so skip.
    const rows = output.split('\n');
    if (rows[0].split(' ')[0] == "ERROR") {
        rows.splice(0, 1);
    }
    const infoObj = JSON.parse(rows.join('\n'));
    return {
        Minimum: infoObj.bands[0].minimum,
        Maximum: infoObj.bands[0].maximum,
        Mean: infoObj.bands[0].mean,
        StDev: infoObj.bands[0].stDev
    }    
}

const cleanIntermediates = (outfile:string) => {
    try { fs.unlinkSync(outfile + '_merged.tif') } catch (e) {}
    try { fs.unlinkSync(outfile + '.prj') } catch (e) {}
    try { fs.unlinkSync(outfile + '.b64') } catch (e) {}
    try { fs.unlinkSync(outfile + '_scaled.prj') } catch (e) {}
    try { fs.unlinkSync(outfile + '.tif.aux.xml') } catch (e) {}
    try { fs.unlinkSync(outfile + '.asc') } catch (e) {}
    try { fs.unlinkSync(outfile + '_scaled.asc') } catch (e) {}
    try { fs.unlinkSync(outfile + '.asc.aux.xml') } catch (e) {}
    try { fs.unlinkSync(outfile + '_scaled.asc.aux.xml') } catch (e) {}
}

function getTileFiles(tileList:string[],tileDir:string) {
    let tileFileList : string[] = [];
    let tilePrefix = "coastalecosystems_";
    for (var t in tileList) {
        const tileName = tileList[t];
        const tileFileName = tileDir + '/' + tileName.substring(0, 3) + '/' + tilePrefix + tileName + '.tif';
        if (fs.existsSync(tileFileName)) {
            tileFileList.push(tileDir + '/' + tileName.substring(0, 3) + '/' + tilePrefix + tileName + '.tif');
        } else {
            console.info("The following tile was missing: " + tileFileName);
        };
    };
    return tileFileList;
}

// Exports
// ______________

export function getTimeSlices(tileDir:string) {
    return Array.from(timeSlices(tileDir).keys());
}

export async function run(
    space:PointWGS84[],
    time:Time,
    tiledir:string, 
    noDataValue:number,
    outputFileTemplate: string,
    buffer?:number,
    resolution?:number ) : Promise<Result<void,string>> {

    const requestBounds = {
        LatMin: Math.min(... space.map(s => s.Latitude)),
        LatMax: Math.max(... space.map(s => s.Latitude)),
        LonMin: Math.min(... space.map(s => s.Longitude)),
        LonMax: Math.max(... space.map(s => s.Longitude))
    };

    const times = timeSlices(tiledir);
    const timeSlice = temporalMatch(times, time);
    if (timeSlice == undefined) {
        winston.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }
    if (timeSlice.Slice == undefined) {
        winston.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }

    const bufferedBounds = bufferBounds(requestBounds, buffer == undefined ? 0 : buffer);
    const tileLookup = tileLookupTable();
    const overlappingTiles = tilesInBounds(tileLookup, bufferedBounds);
    const overlappingTileFiles = getTileFiles(overlappingTiles, timeSlice.Slice);

    // Spawn Python process: MERGE
    let commandOpts = [__dirname + '/gdal_merge.py', '-init', noDataValue, '-a_nodata', noDataValue, '-o', outputFileTemplate + '_merged.tif']
    commandOpts = commandOpts.concat(overlappingTileFiles);
    const outputMerge = await runCommand("python3", commandOpts, true, false);

    // Spawn GDAL process: WINDOW
    commandOpts = ['-of', 'gtiff', '-te', bufferedBounds.LonMin, bufferedBounds.LatMin, bufferedBounds.LonMax, bufferedBounds.LatMax, outputFileTemplate + '_merged.tif', outputFileTemplate + '.tif'];
    const outputWindow = await runCommand("gdalwarp", commandOpts, true, false); 

    // Translate?
    commandOpts = ['-of', 'AAIGrid', outputFileTemplate + '.tif', outputFileTemplate + '.asc'];
    const output = await runCommand('gdal_translate', commandOpts, true, false);

    // TODO Resolution

    // Interpret output
    const outputInfo = await runCommand("gdalinfo", ['-json', '-stats', outputFileTemplate + '.tif'], true, false);
    const gdalInfo = parseGdalInfo(outputInfo);

    // Make json object with stream placeholder.
    const outputJson = {
        dimensions: {
            east: bufferedBounds.LonMax,
            west: bufferedBounds.LonMin,
            north: bufferedBounds.LatMax,
            south: bufferedBounds.LatMin,
            year: timeSlice.Date.Year,
            month: timeSlice.Date.Month,
            day: timeSlice.Date.Day
        },
        summary: gdalInfo,
        data: ""
    };

    // Write output with placeholder
    // NB Remove end of json object to insert data
    let outputJsonString = JSON.stringify(outputJson);
    fs.writeFileSync(outputFileTemplate + '_output.json', outputJsonString.substring(0,outputJsonString.length - 3));
    fs.appendFileSync(outputFileTemplate + '_output.json', "{");
    
    // Replace placeholder with actual data
    const file = readline.createInterface({
        input: fs.createReadStream(outputFileTemplate + '.asc')
    });

    // Processing line-by-line
    let nRows = 0;
    let startLine = -1;
    let lineCount = 0;

    let scale = 1; //TODO Remove variable
    let offset = 0; // TODO Remove variable

    const writeData = () => {
        return new Promise(resolve => {
            file.on('line', function(line) {
                const lineSplit = line.split(' ');
                if (lineSplit[0] == 'ncols') {
                    fs.appendFileSync(outputFileTemplate + "_output.json", '"ncols":' + lineSplit.pop() + ',');
                } else if (lineSplit[0] == 'nrows') {
                    let popped = lineSplit.pop();
                    if (popped !== undefined) {
                        nRows = +popped;
                        fs.appendFileSync(outputFileTemplate + "_output.json", '"nrows":' + nRows.toString() + ',');
                    }
                } else if (lineSplit[0] == 'NODATA_value') {
                    fs.appendFileSync(outputFileTemplate + "_output.json", '"nodata":' + lineSplit.pop() + ',\n"raw":[');
                } else if (!isNaN(Number(lineSplit[0]))) {
                    if (startLine == -1) startLine = lineCount;
        
                    let lineData = (line.substr(1)).split(' ');
                    for (var i = 0; i < lineData.length; i++) {
                        lineData[i] = (Math.round(scale * Number(lineData[i]) + offset)).toString();
                    }
                    if (lineCount - startLine + 1 < nRows)
                        fs.appendFileSync(outputFileTemplate + "_output.json", JSON.stringify(lineData) + ',');
                    else 
                        fs.appendFileSync(outputFileTemplate + "_output.json", JSON.stringify(lineData) + ']}}');
                        resolve();
                }
                lineCount++;
            });
        });
    }

    await writeData();
    winston.info("Cached result to file.");

    // - Organise output format
    // - Organise statistical transforms (should be seperate plugin?)

    cleanIntermediates(outputFileTemplate);
    return { kind: "ok", result: undefined };
}
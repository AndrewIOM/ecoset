import fs from 'fs';
import readline from 'readline';
import { runCommand } from './run-command';
import { PointWGS84, Time, Result, GeospatialForm } from "./../../api/types";
import { timeSlices, temporalMatch } from './time-slices';
import { logger } from '../../api/logger';

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
    for (var x = Math.floor(bounds.LonMin); x <= Math.floor(bounds.LonMax); x++) {
        for (var y = Math.floor(bounds.LatMin); y <= Math.floor(bounds.LatMax); y++) {
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

const parseGdalInfo : ((o:string,scaleFactor:number) => Statistic | undefined) = (output:string,scaleFactor:number) => {
    if (output.length == 0) {
        return undefined;
    }
    const rows = output.split('\n');
    if (rows[0].split(' ')[0] == "ERROR") {
        rows.splice(0, 1);
    }
    const infoObj = JSON.parse(rows.join('\n'));
    return {
        Minimum: infoObj.bands[0].minimum * scaleFactor,
        Maximum: infoObj.bands[0].maximum * scaleFactor,
        Mean: infoObj.bands[0].mean * scaleFactor,
        StDev: infoObj.bands[0].stdDev * scaleFactor
    }
}

const getTiffPixelSize = (output:string) => {
    if (output.length == 0) {
        return undefined;
    }
    const rows = output.split('\n');
    if (rows[0].split(' ')[0] == "ERROR") {
        rows.splice(0, 1);
    }
    const infoObj = JSON.parse(rows.join('\n'));
    return [ infoObj.size[0] as number, infoObj.size[1] as number ];
}

const cleanIntermediates = (outfile:string) => {
    try { fs.unlinkSync(outfile + '.tif') } catch (e) {}
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
    for (var t in tileList) {
        const tileName = tileList[t];
        if (fs.existsSync(tileDir + '/' + tileName.substring(0, 3) + '/')) {
            const tileFileName = fs.readdirSync(tileDir + '/' + tileName.substring(0, 3) + '/').find(tile => tile.toLowerCase().endsWith(tileName + '.tif'));
            if (tileFileName) {
                tileFileList.push(tileDir + '/' + tileName.substring(0, 3) + '/' + tileFileName);
            } else {
                logger.info("The following tile was missing: " + tileName);
            }
        }
    }
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
    scaleFactor:number | undefined,
    outputFileTemplate: string,
    summaryOnly:boolean,
    buffer?:number,
    resolution?:number,
    maxResolution?: number ) : Promise<Result<GeospatialForm,string>> {

    const requestBounds = {
        LatMin: Math.min(... space.map(s => s.Latitude)),
        LatMax: Math.max(... space.map(s => s.Latitude)),
        LonMin: Math.min(... space.map(s => s.Longitude)),
        LonMax: Math.max(... space.map(s => s.Longitude))
    };

    const times = timeSlices(tiledir);
    const timeSlice = temporalMatch(times, time);
    if (timeSlice == undefined) {
        logger.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }
    if (timeSlice.Slice == undefined) {
        logger.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }

    const bufferedBounds = bufferBounds(requestBounds, buffer == undefined ? 0 : buffer);
    const tileLookup = tileLookupTable();
    const overlappingTiles = tilesInBounds(tileLookup, bufferedBounds);
    const overlappingTileFiles = getTileFiles(overlappingTiles, timeSlice.Slice);

    if (overlappingTileFiles.length == 0) {
        return { kind: "failure", message: "There was no data available." }
    }

    // Take account of linear scales used when storing data into tiff files
    const valueScaleFactor = scaleFactor == undefined || scaleFactor == NaN ? 1 : scaleFactor;
    logger.info("Scaling raster values by a factor of: " + valueScaleFactor);

    // Spawn Python process: MERGE
    let commandOpts = [__dirname + '/gdal_merge.py', '-init', noDataValue, '-a_nodata', noDataValue, '-o', outputFileTemplate + '_merged.tif' ]
    commandOpts = commandOpts.concat(overlappingTileFiles);
    await runCommand("python3", commandOpts, false, false).then(_ => {
        logger.info("GDAL merge completed");
    });

    // Spawn GDAL process: WINDOW
    commandOpts = ['-of', 'gtiff', '-te', bufferedBounds.LonMin, bufferedBounds.LatMin, bufferedBounds.LonMax, bufferedBounds.LatMax, outputFileTemplate + '_merged.tif', outputFileTemplate + '.tif'];
    await runCommand("gdalwarp", commandOpts, false, false).then(_ => {
        logger.info("GDAL warp completed");
    });

    // Calculate statistics
    const outputInfo = await runCommand("gdalinfo", ['-json', '-stats', outputFileTemplate + '.tif'], false, false).then(o => {
        logger.info("GDAL info completed");
        return o;
    });
    
    const gdalInfo = parseGdalInfo(outputInfo, valueScaleFactor);
    const outputSize = getTiffPixelSize(outputInfo);
    logger.info("Actual data col/row is: " + JSON.stringify(outputSize));
    if (gdalInfo == undefined || outputSize == undefined) {
        return { kind: "failure", message: "Could not compute summary statistics" };
    }

    commandOpts = ['-of', 'AAIGrid', outputFileTemplate + '.tif', outputFileTemplate + '.asc'];
    if (maxResolution) {
        if ((maxResolution < outputSize[0] || maxResolution < outputSize[1])) {
            resolution = maxResolution;
        }
    }
    if (resolution) {
        if (resolution > 1 && resolution != NaN) {
            // TODO Remove resolution / interpolation from here and place in seperate second transformation step
            logger.info("Reducing output size to " + resolution + " maximum pixels");
            const resScaleFactor = (bufferedBounds.LonMax - bufferedBounds.LonMin) / (bufferedBounds.LatMax - bufferedBounds.LatMin);
            if (resScaleFactor > 1) {
                commandOpts = ['-outsize', resolution, Math.round(resolution / resScaleFactor)].concat(commandOpts);
            } else {
                commandOpts = ['-outsize', Math.round(resolution * resScaleFactor), resolution].concat(commandOpts);
            }
        }
    }
    await runCommand('gdal_translate', commandOpts, false, false).then(o => {
        logger.info("GDAL translate completed");
    });

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

    // TODO Move this function to seperate filter / transform
    if (summaryOnly == true) {
        const json = JSON.stringify(outputJson);
        fs.writeFileSync(outputFileTemplate + '_output.json', json);
        cleanIntermediates(outputFileTemplate);
        return { kind: "ok", result: GeospatialForm.DataTable };    
    }

    // Write output with placeholder
    // NB Remove end of json object to insert data
    const outputJsonString = JSON.stringify(outputJson);
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

    const writeData = () => {
        return new Promise(resolve => {
            file.on('line', line => {
                const lineSplit = line.split(' ');
                if (lineSplit[0] == 'ncols') {
                    fs.appendFileSync(outputFileTemplate + "_output.json", '"ncols":' + lineSplit.pop() + ',');
                } else if (lineSplit[0] == 'nrows') {
                    let popped = lineSplit.pop();
                    if (popped !== undefined) {
                        nRows = +popped;
                        fs.appendFileSync(outputFileTemplate + "_output.json", '"nrows":' + nRows.toString() + ',\n"raw":[');
                    }
                } 
                else if (lineSplit[0] == 'NODATA_value') { } // NODATA value no longer required 
                else if (!isNaN(Number(lineSplit[0]))) {
                    if (startLine == -1) startLine = lineCount;
        
                    let lineData = (line.substr(1)).split(' ');
                    let lineRaw = new Array<number>(lineData.length);
                    for (var i = 0; i < lineData.length; i++) {
                        const v = Number(lineData[i]);
                        if (v != noDataValue) {
                            lineRaw[i] = (v * valueScaleFactor);
                        } else {
                            lineRaw[i] = NaN;
                        }
                    }
                    if (lineCount - startLine + 1 < nRows)
                        fs.appendFileSync(outputFileTemplate + "_output.json", JSON.stringify(lineRaw) + ',');
                    else {
                        fs.appendFileSync(outputFileTemplate + "_output.json", JSON.stringify(lineRaw) + ']}}');
                    }
                }
                lineCount++;
            }).on("close", () => {
                resolve();
            });
        });
    }

    await writeData().then(_ => {
        logger.info("Cached result to file.");
        cleanIntermediates(outputFileTemplate);
    }).catch(e => {
        logger.warn("Could not cache output of tile merge. The error was: " + e);
        return { kind: "failure", result: "Could not cache output. The error was: " + e };
    })

    return { kind: "ok", result: GeospatialForm.Raster };

}
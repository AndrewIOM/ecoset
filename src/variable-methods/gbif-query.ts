import { IVariableMethod, PointWGS84, Result, Time, TemporalDimension, GeospatialForm, DependentResultFile } from "./../api/types"
import fs from 'fs';
import { polygon, buffer } from '@turf/turf';
import { logger } from "../api/logger";
import { RowDataPacket, createPool, Pool } from "mysql2/promise";

type GbifConfig = {
    Host: string
    Username: string
    Password: string
    Database: string
    GbifTable: string
    GbifCoordTable: string
    GbifOrgTable: string
}

enum GbifStatistic {
    Count,
    List
}

type GbifOptions = {
    SubsampleCount: number
    Statistic: GbifStatistic
}

@IVariableMethod.register
export class GbifQueryVariableMethod {

    config: GbifConfig;
    time : TemporalDimension | undefined;
    refreshingTime: boolean;
    conn : Pool;

    constructor(deps:string[],conf:any) {
        this.config = (validateConfig(conf));
        this.refreshingTime = false;
        this.conn = createPool({
            host: this.config.Host,
            port: 3306,
            user: this.config.Username,
            password: this.config.Password,
            database: this.config.Database,
        });
    }

    availableOutputTypes() {
        return [ "list" ];
    }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,dependencies:DependentResultFile[],options:any) {
        const validatedOptions = validateOptions(options);
        const result = await this.runQuery(this.config.GbifTable, this.config.GbifOrgTable, this.config.GbifCoordTable, space, outputDir, validatedOptions);
        return result;
    }

    spatialDimension() { return []; }

    temporalDimension() : TemporalDimension { 
        if (this.time) { 
            return this.time; 
        } else {
            if (!this.refreshingTime) {
                this.refreshingTime = true;
                this.getTime(this.config.GbifTable).then(t => this.time = t );
            }
            return { kind: "timeExtent", minDate: { Year: NaN }, maxDate: { Year: NaN }}; 
        }
    }

    availableForDate() { return true; }

    availableForSpace() { return true; }

    getTime = async (gbifTable: string) : Promise<TemporalDimension | undefined> => {
        this.refreshingTime = true;
        const query = `SELECT MIN(gbif_eventdate) as min, MAX(gbif_eventdate) as max from ${gbifTable}`;
        logger.info("Determining temporal extent of GBIF database...");
        return await this.conn.query<RowDataPacket[]>(query).catch(err => {
            logger.error("Could not determine date range of GBIF data. " + err);
            return undefined;
        }).then(bounds => {
            if (bounds == undefined) return undefined;
            const low = new Date(bounds[0][0].min);
            const high = new Date(bounds[0][0].max);
            logger.info("Found temporal extent for GBIF database: " + low + " to " + high);
            return { kind: "timeExtent", minDate: { Year: low.getFullYear(), Month: low.getMonth() + 1, Day: low.getDay() + 1 }, 
                maxDate: { Year: high.getFullYear(), Month: high.getMonth() + 1, Day: high.getDay() + 1 } };
        })
    }

    runQuery = async (gbifTable: string, gbifOrgTable:string,gbifCoordTable: string, space:PointWGS84[], output:string, options:GbifOptions) : Promise<Result<GeospatialForm,string>> => {
        
        const poly = polygon([space.map(s => [s.Longitude, s.Latitude])]);
        const bufferedPoly = buffer(poly, 3, { units: 'degrees' });
    
        let wkt = "POLYGON ((";
        bufferedPoly.geometry?.coordinates[0].forEach(pos => {
            wkt = wkt + pos[1] + " " + pos[0] + ",";
        });
        wkt = wkt.substr(0, wkt.length - 1) + "))";
        logger.info("WKT for MySQL queries (EPSG lat/lon axis order) is: " + wkt);
    
        let query = "";
        if (options.Statistic == GbifStatistic.List) {
    
            logger.info("Counting GBIF species to determine subsampling strategy...");
            const result = await this.conn.query<RowDataPacket[]>(`select count(*) as count \
                from ${gbifTable} m \
                left join ${gbifCoordTable} c \
                on m.gbif_gbifid=c.gbif_gbifid \
                where gbif_species<>'' and \
                ST_Contains(ST_GeomFromText('${wkt}'), c.coordinate);`)
                .then(([rows, fields]) : Result<RowDataPacket[],string> => { return { kind: "ok", result: rows }; })
                .catch((err) : Result<RowDataPacket[],string> => {
                    logger.error("Could not process GBIF records. " + err);
                    return { kind: "failure", message: "Could not process GBIF records "};
                });
            if (result.kind == "failure") {
                logger.warn("Counting GBIF records (as prerequisite to listing) failed");
                return { kind: "failure", message: "Could not count GBIF records" };
            }
    
            const count = Number.parseInt(result.result[0]['count']);
            if (Number.isNaN(count)) {
                logger.warn("Count response was unexpected: " + JSON.stringify(result.result[0]));
                return { kind: "failure", message: "Could not parse GBIF count" };
            }
            var limit = 50000;
            var modskip = Math.ceil(count / limit);
    
            logger.info("Subsampling " + limit + " from " + count + " occurrences in the GBIF database.");
            query = `select gbif_genus as genus, gbif_species as species, gbif_decimallatitude as lat, gbif_decimallongitude as lon, gbif_kingdom as kingdom, gbif_class as class, gbif_institutioncode as institutionCode, taxonomicgroup as taxon, o.title as title \
                from ${gbifTable} m \
                left join ${gbifOrgTable} o \
                on m.gbif_publishingorgkey=o.gbif_publishingorgkey \
                left join ${gbifCoordTable} c \
                on m.gbif_gbifid=c.gbif_gbifid \
                where gbif_species<>'' and \
                m.gbif_gbifid mod ${modskip} = 0 and \
                ST_Contains(ST_GeomFromText('${wkt}'), c.coordinate) \ 
                limit ${limit};`
    
            } else {
            query = `select taxonomicgroup as taxon, count(distinct gbif_species) as species, count(gbif_species) as count \
            from ${gbifTable} m \
            left join ${gbifCoordTable} c \
            on m.gbif_gbifid=c.gbif_gbifid \
            where gbif_species<>'' and \
            ST_Contains(ST_GeomFromText('${wkt}'), c.coordinate) \
            group by taxonomicgroup;`;
        }
    
        logger.debug("Running GBIF query: " + query);
    
        const result = await this.conn.query<RowDataPacket[]>(query).then(([rows, fields]) : Result<RowDataPacket[],string> => {
            logger.info("GBIF query was successful");
            return { kind: "ok", result: rows };
        }).catch((err) : Result<RowDataPacket[],string> => {
            logger.error("Could not process GBIF records. " + err);
            return { kind: "failure", message: "Could not process GBIF records "};
        });
    
        if (result.kind == "failure") {
            return { kind: "failure", message: "Could not retrieve subsampled GBIF records" };
        } else {
            fs.writeFileSync(output + "_output.json", JSON.stringify(result.result));
            return { kind: "ok", result: GeospatialForm.DataTable };
        }

    }

}

const validateConfig = (config:any) => {

    if (config.host == null || config.username == null ||
        config.password == null || config.database == null ||
        config.gbif_table == null || config.gbif_org_table == null || config.gbif_coord_table == null) 
        throw Error("Database configuration was incomplete.");

    const c : GbifConfig = {
        Host: config.host,
        Username: config.username,
        Password: config.password,
        Database: config.database,
        GbifTable: config.gbif_table,
        GbifCoordTable: config.gbif_coord_table,
        GbifOrgTable: config.gbif_org_table
    }
    return c;
}

const validateOptions = (config:any) => {
    let c : GbifOptions = {
        SubsampleCount: 50000,
        Statistic: GbifStatistic.List
    }
    if (config) {
        if (config.statistic == "count") c.Statistic = GbifStatistic.Count
    }
    return c;
}
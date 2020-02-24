import { IVariableMethod, PointWGS84, Result, Time, TemporalDimension, GeospatialForm } from "./../api/types"
import {Index, Entity, Connection, Column, PrimaryGeneratedColumn, getConnectionManager } from "typeorm";
import fs from 'fs';
import { polygon, buffer } from '@turf/turf';
import { logger } from "../api/logger";

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

@IVariableMethod.register
export class GbifQueryVariableMethod {

    config: GbifConfig;
    time : TemporalDimension | undefined;
    conn : Connection | undefined;

    constructor(conf:any) {
        this.config = (validateConfig(conf));

        const connectionManager = getConnectionManager();
        const connection = connectionManager.create({
            type: "mysql",
            host: this.config.Host,
            port: 3306,
            username: this.config.Username,
            password: this.config.Password,
            database: this.config.Database,
            cache: true
        });

        connection.connect()
        .then(c => {
            this.conn = c;
            getTime(this.conn, this.config.GbifTable).then(t => this.time = t );
        })
        .catch(e => {
            logger.error("Error connecting to GBIF database: " + e);
        });

    }

    availableOutputTypes() {
        return [ "list" ];
    }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,options:any) {
        const validatedOptions = validateOptions(options);
        return runQuery(this.conn, this.config.GbifTable, this.config.GbifOrgTable, this.config.GbifCoordTable, space, outputDir, validatedOptions);
     }

    spatialDimension() { return []; }

    temporalDimension() : TemporalDimension { 
        if (this.time) { return this.time; }
        return { kind: "timeExtent", minDate: { Year: 1980 }, maxDate: { Year: 2020 }}; 
    }

    availableForDate() { return true; }

    availableForSpace() { return true; }
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

const getTime = async (conn: Connection | undefined, gbifTable: string) : Promise<TemporalDimension | undefined> => {

    if (conn == undefined) { return undefined; }
    const query = `SELECT MIN(gbif_eventdate) as min, MAX(gbif_eventdate) as max from ${gbifTable}`;
    logger.info("Determining temporal extent of GBIF database...");

    return await conn.query(query).catch(err => {
        logger.error("Could not determine date range of GBIF data. " + err);
        return undefined;
    }).then(bounds => {
        logger.info("Found temporal extent for GBIF database: " + JSON.stringify(bounds));
        const low = new Date(bounds[0].min);
        const high = new Date(bounds[0].max);
        return { kind: "timeExtent", minDate: { Year: low.getFullYear(), Month: low.getMonth() + 1, Day: low.getDay() + 1 }, 
            maxDate: { Year: high.getFullYear(), Month: high.getMonth() + 1, Day: high.getDay() + 1 } };
    })
}

const runQuery = async (conn: Connection | undefined, gbifTable: string, gbifOrgTable:string,
    gbifCoordTable: string, space:PointWGS84[], output:string, options:GbifOptions) : Promise<Result<GeospatialForm,string>> => {

    if (conn == undefined) {
        return { kind: "failure", message: "Could not connect to GBIF database" };
    }

    const poly = polygon([space.map(s => [s.Latitude, s.Longitude])]);
    const bufferedPoly = buffer(poly, 3, { units: 'degrees' });

    let wkt = "POLYGON ((";
    bufferedPoly.geometry?.coordinates[0].forEach(pos => {
        wkt = wkt + pos[0] + " " + pos[1] + ",";
    });
    wkt = wkt.substr(0, wkt.length - 1) + "))";
    logger.info("WKT is: " + wkt);

    let query = "";
    if (options.Statistic == GbifStatistic.List) {

        logger.info("Counting GBIF species to determine subsampling strategy...");
        const result = await conn.query(`select count(*) as count \
            from ${gbifTable} m \
            left join ${gbifCoordTable} c \
            on m.gbif_gbifid=c.gbif_gbifid \
            where gbif_species<>'' and \
            ST_Contains(ST_GeomFromText('${wkt}'), c.coordinate);`)
            .catch(err => {
                logger.error("Could not process GBIF records. " + err);
                return { kind: "failure", message: "Could not process GBIF records "};
            });

        logger.debug(result);

        const count = Number.parseInt(result[0].count);
        var limit = 50000;
        var modskip = Math.ceil(count / limit);

        logger.info("Subsampling " + limit + "/ " + count + " occurrences from GBIF data...");
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

    return await conn.query(query).catch(err => {
        logger.error("Could not process GBIF records. " + err);
        return { kind: "failure", message: "Could not process GBIF records "};
    }).then(counts => {
        logger.info("Processed GBIF records successfully");
        fs.writeFileSync(output + "_output.json", JSON.stringify(counts));
        return { kind: "ok", result: GeospatialForm.DataTable };
    })

}


@Entity("master")
export class GbifRecord {

    @PrimaryGeneratedColumn()
    gbif_gbifid!: number;

    @Column({ type: "varchar", length: 255 })
    gbif_eventdate!: string;

    @Column({ type: "varchar", length: 255 })
    gbif_kingdom!: string;

    @Column({ type: "varchar", length: 255 })
    gbif_phylum!: string;

    @Column({ type: "varchar", length: 255 })
    gbif_class!: string;

    @Column({ type: "varchar", length: 255 })
    gbif_order!: string;

    @Column({ type: "varchar", length: 255 })
    gbif_family!: string;

    @Column({ type: "varchar", length: 255 })
    gbif_genus!: string;

    @Column({ type: "varchar", length:255 })
    gbif_infraspecificepithet!: string

    @Column({ type: "varchar", length:255 })
    gbif_species!: string

    @Column({ type: "longtext" })
    gbif_locality!: string

    @Column({ type: "varchar", length:255 })
    gbif_publishingorgkey!: string

    @Column({ type: "varchar", length:255 })
    gbif_taxonkey!: string

    @Column({ type: "varchar", length:255 })
    gbif_lastinterpreted!: string

    @Column({ type: "varchar", length:255 })
    gbif_institutioncode!: string

    @Column({ type: "varchar", length:255 })
    gbif_coordinateuncertaintyinmeters!: string

    @Column({ type: "float", nullable: false })
    gbif_decimallatitude!: number

    @Column({ type: "float", nullable: false })
    gbif_decimallongitude!: number

    @Column({ type: "varchar", length:255 })
    taxonomicgroup!: string
}

@Entity("gbif_coordinate")
export class GbifCoordinate {

    @PrimaryGeneratedColumn()
    gbif_gbifid!: number

    @Column({ type: "point", srid: 0, nullable: false })
    @Index("idx_coord", { spatial: true })
    coordinate!: string
}

@Entity("gbif_org_lookup")
export class GbifOrganisation {

    @PrimaryGeneratedColumn()
    @Column({ type: "varchar", length: 255 })
    gbif_publishingorgkey!: string

    @Column({ type: "varchar", length: 255 })
    title!: string
}
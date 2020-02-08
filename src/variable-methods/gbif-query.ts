import { IVariableMethod, PointWGS84, Result, Time, TemporalDimension } from "./../api/types"
import {Index, Entity, Column, PrimaryGeneratedColumn, getConnectionManager, createQueryBuilder, getRepository} from "typeorm";
import config from "config";

@IVariableMethod.register
class GbifQueryVariableMethod {

    availableOutputTypes() {
        return [ "list" ];
    }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,options:any) {
        return count(space);
     }

    spatialDimension() { return []; }

    temporalDimension() : TemporalDimension { 
        return { kind: "timeExtent", minDate: { Year: 1980 }, maxDate: { Year: 2020 }}; }

    availableForDate() { return true; }

    availableForSpace() { return true; }
}

// Entity

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

// Use it
// Setup mysql

const connectionManager = getConnectionManager();
const connection = connectionManager.create({
    type: "mysql",
    host: config.get("gbifdb.host"),
    port: 3306,
    username: config.get("gbifdb.username"),
    password: config.get("gbifdb.password"),
    database: config.get("gbifdb.database"),
});

import turf from '@turf/turf';

const count = async (space:PointWGS84[]) : Promise<Result<void,string>> => {

    // 1. Make a connection
    let conn = await connection.connect();//.catch(e => {
    //     console.log("Error connecting to GBIF mirror: " + e);
    //     return { kind: "error", message: "Could not connect to GBIF database" }
    // });

    const buffer = 3;
    const poly = turf.polygon([space.map(s => [s.Latitude, s.Longitude])]);
    const bufferedPoly = turf.buffer(poly, buffer);

    

    // const query = `select count(*) as count \
    // from ${config.get("gbif_list.gbif_table")} m \
    // left join ${config.get("gbif_list.gbif_coord_table")} c \
    // on m.gbif_gbifid=c.gbif_gbifid \
    // where gbif_species<>'' and \
    // mbrcontains(ST_GeomFromText(CONCAT('LINESTRING(', ?, ' ', ?, ',', ?, ' ', ?, ')')), coordinate); \
    // `, [bufferedSouth, bufferedWest, bufferedNorth, bufferedEast]


    const count = await conn
        .getRepository(GbifRecord)
        .createQueryBuilder("record")
        .leftJoinAndSelect("record.gbif_gbifid", "gbif_gbifid")
        .where("record.gbif_species <> :name", { name: "" })
        .where('')
        // .leftJoinAndSelect("")
        .getMany();

    return { kind: "ok", result: undefined };

}
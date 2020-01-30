import { IVariableMethod, PointWGS84, Result } from "./../api/types"
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

    spatialDimension() { }

    temporalDimension() { }

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

const count = async (space:PointWGS84[]) => {

    // 1. Make a connection
    let conn = await connection.connect();//.catch(e => {
    //     console.log("Error connecting to GBIF mirror: " + e);
    //     return { kind: "error", message: "Could not connect to GBIF database" }
    // });

    const buffer = 3; // Three degrees buffer added to query.

    // How to buffer random polygon?

    const count = await getRepository(GbifRecord)
        .createQueryBuilder("record")
        .leftJoinAndSelect()

    

    return { kind: "ok", result: 2 };

}
import winston, { format } from 'winston';
import config from 'config';

const dirName = config.has("locations.logs") ? config.get("locations.logs") as string : "/logs";

export const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
        winston.format.json(),
        winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss'})),
        transports: [
        new winston.transports.File({ filename: 'error.log', dirname: dirName, level: 'error', maxsize: 26214400, zippedArchive: true }),
        new winston.transports.File({ filename: 'combined.log', dirname: dirName, maxsize: 26214400, zippedArchive: true })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YY-MM-DD HH:mm'}),
            winston.format.prettyPrint(),
            winston.format.simple())
    }));
}
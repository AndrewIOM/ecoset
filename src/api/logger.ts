import { createLogger, transports, format } from 'winston';
import config from 'config';

const dirName = config.has("locations.logs") ? config.get("locations.logs") as string : "/logs";

export const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.json(),
        format.timestamp({ format: 'YY-MM-DD HH:mm:ss'})),
        transports: [
        new transports.File({ filename: 'error.log', dirname: dirName, level: 'error', maxsize: 26214400, zippedArchive: true }),
        new transports.File({ filename: 'combined.log', dirname: dirName, maxsize: 26214400, zippedArchive: true })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'YY-MM-DD HH:mm'}),
            format.prettyPrint(),
            format.simple())
    }));
}
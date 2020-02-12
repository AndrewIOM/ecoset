import winston, { format } from 'winston';

export const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
        winston.format.json(),
        winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss'})),
        transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
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

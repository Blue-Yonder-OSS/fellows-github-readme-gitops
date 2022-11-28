import * as winston from 'winston';

const alignColorsAndTime = winston.format.combine(
    winston.format.colorize({
        all: true
    }),
    winston.format.label({
        label: '[LOGGER]'
    }),
    winston.format.timestamp({
        format: "YYYY-MM-DD HH:MM:SS"
    }),
    winston.format.printf(
        info => `${info.timestamp}  ${info.level} : ${info.message}`
    )
)

export default winston.createLogger({
    level: (process.env.NODE_ENV || 'development') === 'development' ? 'debug' : 'info',
    transports: [
        new (winston.transports.Console)({
            format: alignColorsAndTime
        })
    ],
})
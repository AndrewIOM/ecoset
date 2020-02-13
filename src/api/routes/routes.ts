/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { Controller, ValidationService, FieldErrors, ValidateError, TsoaRoute } from 'tsoa';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { DataPackageController } from './../controllers/package.controller';
import * as express from 'express';

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "JobState": {
        "dataType": "refEnum",
        "enums": ["NonExistent", "Queued", "Processing", "Ready", "Failed"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Latest": {
        "dataType": "refObject",
        "properties": {
            "kind": { "dataType": "enum", "enums": ["latest"], "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SimpleDate": {
        "dataType": "refAlias",
        "type": { "dataType": "nestedObjectLiteral", "nestedProperties": { "Day": { "dataType": "double" }, "Month": { "dataType": "double" }, "Year": { "dataType": "double", "required": true } }, "validators": {} },
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TimeExact": {
        "dataType": "refObject",
        "properties": {
            "kind": { "dataType": "enum", "enums": ["exact"], "required": true },
            "date": { "ref": "SimpleDate", "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TimeBefore": {
        "dataType": "refObject",
        "properties": {
            "kind": { "dataType": "enum", "enums": ["before"], "required": true },
            "date": { "ref": "SimpleDate", "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Time": {
        "dataType": "refAlias",
        "type": { "dataType": "union", "subSchemas": [{ "ref": "Latest" }, { "ref": "TimeExact" }, { "ref": "TimeBefore" }], "validators": {} },
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Variable": {
        "dataType": "refAlias",
        "type": { "dataType": "nestedObjectLiteral", "nestedProperties": { "Method": { "dataType": "string", "required": true }, "Name": { "dataType": "string", "required": true } }, "validators": {} },
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "EcosetJobRequest": {
        "dataType": "refObject",
        "properties": {
            "LatitudeNorth": { "dataType": "double", "required": true },
            "LatitudeSouth": { "dataType": "double", "required": true },
            "LongitudeWest": { "dataType": "double", "required": true },
            "LongitudeEast": { "dataType": "double", "required": true },
            "TimeMode": { "ref": "Time", "required": true },
            "Year": { "dataType": "double", "required": true },
            "Month": { "dataType": "double", "required": true },
            "Day": { "dataType": "double", "required": true },
            "Executables": { "dataType": "array", "array": { "dataType": "refAlias", "ref": "Variable" }, "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SlicedTime": {
        "dataType": "refObject",
        "properties": {
            "kind": { "dataType": "enum", "enums": ["timeSlice"], "required": true },
            "slices": { "dataType": "array", "array": { "dataType": "refAlias", "ref": "SimpleDate" }, "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ContinuousTime": {
        "dataType": "refObject",
        "properties": {
            "kind": { "dataType": "enum", "enums": ["timeExtent"], "required": true },
            "minDate": { "ref": "SimpleDate", "required": true },
            "maxDate": { "ref": "SimpleDate", "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TemporalDimension": {
        "dataType": "refAlias",
        "type": { "dataType": "union", "subSchemas": [{ "ref": "SlicedTime" }, { "ref": "ContinuousTime" }], "validators": {} },
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PointWGS84": {
        "dataType": "refAlias",
        "type": { "dataType": "nestedObjectLiteral", "nestedProperties": { "Longitude": { "dataType": "double", "required": true }, "Latitude": { "dataType": "double", "required": true } }, "validators": {} },
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "MethodDTO": {
        "dataType": "refObject",
        "properties": {
            "Id": { "dataType": "string", "required": true },
            "Name": { "dataType": "string", "required": true },
            "License": { "dataType": "string", "required": true },
            "LicenseUrl": { "dataType": "string", "required": true },
            "TemporalExtent": { "ref": "TemporalDimension", "required": true },
            "SpatialExtent": { "dataType": "array", "array": { "dataType": "refAlias", "ref": "PointWGS84" }, "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "VariableDTO": {
        "dataType": "refObject",
        "properties": {
            "Id": { "dataType": "string", "required": true },
            "FriendlyName": { "dataType": "string", "required": true },
            "Description": { "dataType": "string", "required": true },
            "Unit": { "dataType": "string", "required": true },
            "Methods": { "dataType": "array", "array": { "ref": "MethodDTO" }, "required": true },
        },
        "additionalProperties": true,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const validationService = new ValidationService(models);

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

export function RegisterRoutes(app: express.Express) {
    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################
    app.get('/api/v1/Data/status/:packageId',
        function(request: any, response: any, next: any) {
            const args = {
                packageId: { "in": "path", "name": "packageId", "required": true, "dataType": "double" },
            };

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = getValidatedArgs(args, request);
            } catch (err) {
                return next(err);
            }

            const controller = new DataPackageController();


            const promise = controller.status.apply(controller, validatedArgs as any);
            promiseHandler(controller, promise, response, next);
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    app.post('/api/v1/Data/submit',
        function(request: any, response: any, next: any) {
            const args = {
                jobRequest: { "in": "body", "name": "jobRequest", "required": true, "ref": "EcosetJobRequest" },
            };

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = getValidatedArgs(args, request);
            } catch (err) {
                return next(err);
            }

            const controller = new DataPackageController();


            const promise = controller.submit.apply(controller, validatedArgs as any);
            promiseHandler(controller, promise, response, next);
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    app.get('/api/v1/Data/list',
        function(request: any, response: any, next: any) {
            const args = {
            };

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = getValidatedArgs(args, request);
            } catch (err) {
                return next(err);
            }

            const controller = new DataPackageController();


            const promise = controller.list.apply(controller, validatedArgs as any);
            promiseHandler(controller, promise, response, next);
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    app.get('/api/v1/Data/fetch/:packageId',
        function(request: any, response: any, next: any) {
            const args = {
                packageId: { "in": "path", "name": "packageId", "required": true, "dataType": "double" },
            };

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = getValidatedArgs(args, request);
            } catch (err) {
                return next(err);
            }

            const controller = new DataPackageController();


            const promise = controller.fetch.apply(controller, validatedArgs as any);
            promiseHandler(controller, promise, response, next);
        });
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function isController(object: any): object is Controller {
        return 'getHeaders' in object && 'getStatus' in object && 'setStatus' in object;
    }

    function promiseHandler(controllerObj: any, promise: any, response: any, next: any) {
        return Promise.resolve(promise)
            .then((data: any) => {
                let statusCode;
                if (isController(controllerObj)) {
                    const headers = controllerObj.getHeaders();
                    Object.keys(headers).forEach((name: string) => {
                        response.set(name, headers[name]);
                    });

                    statusCode = controllerObj.getStatus();
                }

                // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

                if (data && typeof data.pipe === 'function' && data.readable && typeof data._read === 'function') {
                    data.pipe(response);
                } else if (data || data === false) { // === false allows boolean result
                    response.status(statusCode || 200).json(data);
                } else {
                    response.status(statusCode || 204).end();
                }
            })
            .catch((error: any) => next(error));
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function getValidatedArgs(args: any, request: any): any[] {
        const fieldErrors: FieldErrors = {};
        const values = Object.keys(args).map((key) => {
            const name = args[key].name;
            switch (args[key].in) {
                case 'request':
                    return request;
                case 'query':
                    return validationService.ValidateParam(args[key], request.query[name], name, fieldErrors, undefined, { "controllerPathGlobs": ["./api/controllers/**/*controller.ts"], "specVersion": 3 });
                case 'path':
                    return validationService.ValidateParam(args[key], request.params[name], name, fieldErrors, undefined, { "controllerPathGlobs": ["./api/controllers/**/*controller.ts"], "specVersion": 3 });
                case 'header':
                    return validationService.ValidateParam(args[key], request.header(name), name, fieldErrors, undefined, { "controllerPathGlobs": ["./api/controllers/**/*controller.ts"], "specVersion": 3 });
                case 'body':
                    return validationService.ValidateParam(args[key], request.body, name, fieldErrors, name + '.', { "controllerPathGlobs": ["./api/controllers/**/*controller.ts"], "specVersion": 3 });
                case 'body-prop':
                    return validationService.ValidateParam(args[key], request.body[name], name, fieldErrors, 'body.', { "controllerPathGlobs": ["./api/controllers/**/*controller.ts"], "specVersion": 3 });
            }
        });

        if (Object.keys(fieldErrors).length > 0) {
            throw new ValidateError(fieldErrors, '');
        }
        return values;
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

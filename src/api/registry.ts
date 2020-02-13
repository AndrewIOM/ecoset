import { IVariableMethod, PointWGS84, TemporalDimension } from "./types";
import config from 'config';
import { logger } from './logger';
import  "./../variable-methods/index";

// Configuration file parser
// __________________________

type MethodListItem = {
    Id: string
    FriendlyName: string
    Description: string
    License: string
    LicenseUrl: string
    Implementation: string
    DependsOn: string[]
    Options: any
}

type VariableListItem = {
    Id: string
    FriendlyName: string
    Description: string
    Unit: string
    Methods: MethodListItem[]
}

let parseVariableConfiguration = 
    (vars:any[]) : VariableListItem[] =>
        vars.map((x:any) => {
            let keys = Object.keys(x);
            let name = keys[0];
            let v = x[name];
            let methods =
                v.methods.map((m:any) => {
                    let methodKeys = Object.keys(m);
                    let methodName = methodKeys[0];
                    let method = m[name];
                    return {
                        Id: methodName,
                        FriendlyName: method.name,
                        Description: method.description,
                        Implementation: method.implementation,
                        License: method.license,
                        LicenseUrl: method.licenseUrl,
                        DependsOn: method.depends_on == undefined ? [] : method.depends_on,
                        Options: method.options
                    }
                })
            return {
                Id: name,
                FriendlyName: v.name,
                Description: v.description,
                Unit: v.Unit,
                Methods: methods
            }
        });

// Helpers
// __________________________

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

const variablesWithDimensions = (vars:VariableListItem[]) => {
    return vars.map(v => {
        const methods = 
            v.Methods.map(m => {
                const imp = variableMethods.find(vm => m.Implementation == vm.name.replace("VariableMethod",""));
                const dependenciesExist = m.DependsOn.every(d => variables.find(x => x.Id == d) !== undefined);
                if (imp == undefined || !dependenciesExist) { return null; }
                const method = new imp(m.Options);
                return {
                    Id: m.Id,
                    Name: m.FriendlyName,
                    License: m.License,
                    LicenseUrl: m.LicenseUrl,
                    Time: method.temporalDimension(),
                    Space: method.spatialDimension(),
                    Imp: method
                }
            }).filter(notEmpty);
        return {
            Id: v.Id,
            Name: v.FriendlyName,
            Description: v.Description,
            Unit: v.Unit,
            Methods: methods
        }
    });
}

interface MethodDTO {
    Id: string,
    Name: string,
    License: string,
    LicenseUrl: string,
    TemporalExtent: TemporalDimension,
    SpatialExtent: PointWGS84[]
}

interface VariableDTO {
    Id: string
    FriendlyName: string
    Description: string
    Unit: string
    Methods: MethodDTO[]
}

// Load variables and config
// __________________________

const variables = parseVariableConfiguration(config.get("variables"));
const variableMethods = IVariableMethod.getImplementations();
const implementedVariables = variablesWithDimensions(variables);

variableMethods.forEach(v => { logger.info("Loaded method: " + v.name) })
implementedVariables.forEach(v => { logger.info("Loaded variable: " + v.Name) })

export function listVariables () {
    return implementedVariables;
}

export function getDependencies (variableId:string, methodId:string) {
    const v = variables.find(m => m.Id == variableId);
    if (v) {
        const method = v.Methods.find(m => m.Id == methodId);
        if (method) {
            return method.DependsOn;
        }
    }
    return [];
}

export function listVariableDtos () : VariableDTO[] {
    return implementedVariables.map(v => {
        return {
            Id: v.Id,
            FriendlyName: v.Name, 
            Description: v.Description,
            Unit: v.Unit,
            Methods: v.Methods.map(m => {
                return {
                    Id: m.Id,
                    Name: m.Name,
                    License: m.License,
                    LicenseUrl: m.LicenseUrl,
                    TemporalExtent: m.Imp.temporalDimension(),
                    SpatialExtent: m.Imp.spatialDimension()              
                }
            })
        }
    })
}
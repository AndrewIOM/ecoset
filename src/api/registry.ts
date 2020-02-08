import { IVariableMethod, PointWGS84, TemporalDimension } from "./types";
import config from 'config';
import winston from 'winston';
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
    (variables:any[]) : VariableListItem[] =>
        variables.map((x:any) => {
            let keys = Object.keys(x);
            let name = keys[0];
            let v = x[name];
            let methods =
                v.methods.map((m:any) => {
                    let keys = Object.keys(m);
                    let name = keys[0];
                    let v = m[name];
                    return {
                        Id: name,
                        FriendlyName: v.name,
                        Description: v.description,
                        Implementation: v.implementation,
                        License: v.license,
                        LicenseUrl: v.licenseUrl,
                        DependsOn: v.depends_on == undefined ? [] : v.depends_on,
                        Options: v.options
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

const variablesWithDimensions = (variables:VariableListItem[]) => {
    return variables.map(v => {
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


// Load variables and config
// __________________________

const variables = parseVariableConfiguration(config.get("variables"));
const variableMethods = IVariableMethod.getImplementations();
const friendlyVariables = variablesWithDimensions(variables);

variableMethods.map(v => { winston.info("Loaded method: " + v.name) })
variables.map(v => { winston.info("Loaded variable: " + v.FriendlyName) })
friendlyVariables.map(v => winston.info("Loaded dimensions for: " + v.Name))

export function listVariables () {
    return friendlyVariables;
}

export function getDependencies (variableId:string, methodId:string) {
    const v = variables.find(m => m.Id == variableId);
    if (v) {
        const m = v.Methods.find(m => m.Id == methodId);
        if (m) {
            return m.DependsOn;
        }
    }
    return [];
}
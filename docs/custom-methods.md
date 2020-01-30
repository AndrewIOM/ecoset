---
id: custom-methods
title: Creating Custom Variable Methods 
---

The implementation of custom methods is extremely flexible. A custom Ecoset method must be implemented as a class that conforms to the ``IVariableMethod`` type signature:

```typescript
// Represents a computation function for a variable
export interface IVariableMethod {

    // Runs computation for given spatial-temporal constraints and outputs to file.
    computeToFile(space:PointWGS84[],time:Time,outputDir:string,options:any) : Promise<Result<unit,string>>;

    // Returns the spatial dimensions for which computation can be conducted.
    spatialDimension() : PointWGS84[];

    // Returns the spatial dimensions for which computation can be conducted.
    temporalDimension(): TemporalDimension;

    // True if data can be computed for the specified date.
    availableForDate(date:Date) : boolean;

    // True if data can be computed for specified point cloud.
    availableForSpace(points:PointWGS84[]): boolean;

    // List output options
    availableOutputTypes() : string[]
}
```

Ecoset will automatically discover new methods if their containing file is imported into the Typescript application. Methods must be implemented using the ``@IVariableMethod.register`` decorator for this to work correctly:

```typescript
//test-plugin.ts

import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result } from "./../api/types"

@IVariableMethod.register
class TestVariableMethod {

    private config : TestMethodConfig;

    constructor(conf:any) {
        this.config = (validateConfig(conf));
    }

    availableOutputTypes() {
        return [ "json" ];
    }

    spatialDimension() {
        let boundingBox = [
            { Latitude: 90, Longitude: -180 },
            { Latitude: -90, Longitude: -180 },
            { Latitude: -90, Longitude: 180 },
            { Latitude: 90, Longitude: 180 },
            { Latitude: 90, Longitude: -180 }
        ]
        return boundingBox;
    }

    temporalDimension() : TemporalDimension {
        let slices : SlicedTime = {
            kind: "timeSlice",
            slices: getTimeSlices()
        }
        return (slices);
    }

    availableForDate() { return true; }

    availableForSpace() { return true; }

    computeToFile(space:PointWGS84[],time:Time,outputDir:string,options:any) : Promise<Result<void, string>> {
        return doSomething(space, time, outputDir, options);
    }
}

type TestMethodConfig = {
    NoDataValue: number
}

const validateConfig = (config:any) => {
    return c;
}

```

Using the built-in *run-command* utility, a variable may call another process. The inbuilt GeoTIFF method integrates with the GDAL command line utilities in this way.

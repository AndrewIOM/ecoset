import { IVariableMethod } from "./../api/types"

@IVariableMethod.register
class GbifQueryVariableMethod {

    computeToFile() { }

    spatialDimension() { }

    temporalDimension() { }

    availableForDate() { return true; }

    availableForSpace() { return true; }
}


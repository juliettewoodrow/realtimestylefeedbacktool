import { MAGIC_NUMBER_INFO_KEYS, MAGIC_NUMBER_FILTER_VALUES } from "./MagicNumbersPrompts.js";
import { isNumericLike } from "./Utils.js";

const MAX_SCORE = 0.5

// Functions to clean and trim GPT Responses
// Gets rid of anything before the first { and after the last }
function trimResponse(response) {
    return response.substr(response.indexOf("{"), response.lastIndexOf("}") + 1)
}

// validates the keys of the JSON object for identifier feedback
function validateMagicNumberKeys(json) {
    // For each variable, ensure it has a keys: alternate_names, why (stored in constant above)
    Object.keys(json).forEach((key) => {
        const magicNumberInfo = json[key]
        const magicNumberInfoKeys = Object.keys(magicNumberInfo)
        MAGIC_NUMBER_INFO_KEYS.forEach((key) => { 
            // If any of the keys are not in the identifierInfoKeys, return false
            if(!magicNumberInfoKeys.includes(key)) {
                return false
            }
        })
    })
    // If we get here, all the variables have all the necessary keys in their inner dictionaries
    return true
}

function filterMagicNumbers(json) {
    const magicNumbersUsed = json['magic_numbers_used']
    const filteredMagicNumbers = {}
    Object.keys(magicNumbersUsed).forEach((key) => {
        const magicNumberInfo = magicNumbersUsed[key]
        if(!MAGIC_NUMBER_FILTER_VALUES.includes(key.toString())) {
            filteredMagicNumbers[key] = magicNumberInfo
        }
    })
    json['magic_numbers_used'] = filteredMagicNumbers
    return json
}


// Trims the response using trimResponse fn and then parses it into a JSON object
const parseResponse = (response) => {
    // TODO: make sure the keys are the exact keys we want. See prompt
    const trimmedResponse = trimResponse(response)
    // console.log("After trimming:", trimmedResponse)
    try {
        const parsedObject = JSON.parse(trimmedResponse);
        if (typeof(parsedObject) === 'object' && parsedObject !== null) {
            // console.log("Parsed Object:", parsedObject)
            return parsedObject
        }
      } catch (error) {
        console.error('The string is not a valid JSON object.');
    }
    return undefined
}

export function getUsedMagicNumbersInfo(magicNumbersUsed, constants_defined) {
    const magic_numbers_need_constants = {}
    const has_constant_didnt_use = {}
    const magicNumbers = Object.keys(magicNumbersUsed)
    magicNumbers.map((magicNumber) => {
        if(isNumericLike(magicNumber)) {
            Object.keys(constants_defined).map((constant) => {
                if(isNumericLike(constants_defined[constant])) {
                    if(parseFloat(magicNumber) === parseFloat(constants_defined[constant])) {
                        has_constant_didnt_use[magicNumber] = constant
                    }
                }
            })
            if(!has_constant_didnt_use[magicNumber]) {
                magic_numbers_need_constants[magicNumber] = magicNumbersUsed[magicNumber]
            }
        }

    })
    return [magic_numbers_need_constants, has_constant_didnt_use]
}

export function getMagicNumbersFeedback(variablesToLineNums, magicNumsToLineNums) {
    
    // Create found constants. All of the values in variablesToLineNums that are only on the left side of an assignment once in the program 
    const foundConstants = {} // maps defined constants to their values 
    Object.keys(variablesToLineNums).map((variable) => {
        const lineNumKeys = Object.keys(variablesToLineNums[variable])
        if(lineNumKeys.length === 1) {
            const lineNum = lineNumKeys[0]
            const lineNumValue = variablesToLineNums[variable][lineNum]
            foundConstants[variable] = lineNumValue
        }
    })

    // Create foundConstantsNumbers which is the same as foundConstants but only contains constants that store numbers
    const foundConstantsNumbers = {} // maps defined numeric constants to their values 
    Object.keys(foundConstants).map((constant) => {
        const value = foundConstants[constant]
        if(isNumericLike(value)) {
            foundConstantsNumbers[constant] = foundConstants[constant]
        }   
    })

    // Grab all of the values that the student defined as all uppercase 
    const uppercaseValues = [] // list of all uppercase values
    Object.keys(variablesToLineNums).map((variable) => {
        if(variable === variable.toUpperCase()) {
            uppercaseValues.push(variable)
        }
    })

    console.log("Uppercase Values", uppercaseValues)

    // Create definedConstantDidntUse
    // for all found constans, get value. check if magicNumsToLineNums[value] has > 1 line_nums 
    // if yes, they should have used the constant so add to definedConstantDidntUse
    const definedConstantDidntUse = [] // list of constants that were defined but not used
    Object.keys(foundConstantsNumbers).map((constant) => {
        const magicNumAssigned = foundConstantsNumbers[constant]
        if (Object.keys(magicNumsToLineNums).includes(magicNumAssigned)) {
            const lineNumsUsed = magicNumsToLineNums[magicNumAssigned]
            if(lineNumsUsed.length > 1) {
                definedConstantDidntUse.push(constant)
            }
        } 
    })

    console.log("Defined Constant Didn't Use", definedConstantDidntUse)

    // Create magicNumbersNeedConstants
    // For all magic numbers, check if they are in foundConstantsNumbers. 
    // If not, add to magicNumbersNeedConstants
    const magicNumbersNeedConstants = [] // list of magic numbers that need to be defined as constants
    Object.keys(magicNumsToLineNums).map((magicNumber) => {
        const definedConstantValues = Object.values(foundConstantsNumbers)
        if(!MAGIC_NUMBER_FILTER_VALUES.includes(magicNumber)) { //Filter out 0s and 1s
            if(!definedConstantValues.includes(magicNumber)) {
                if(!isNaN(parseFloat(magicNumber))) {
                    magicNumbersNeedConstants.push(magicNumber)
                }
            }
        }
    })

    console.log("Magic Numbers Need Constants", magicNumbersNeedConstants)


    // Create constantsUsedAsVariables 
    // Anything defined in all uppercase that is on the left hand side of an equal sign > 1 time
    // take the difference between uppercase_values and found_constants
    const constantsUsedAsVariables = [] // list of constants that were used as variables
    uppercaseValues.map((constant) => {
        if(!Object.keys(foundConstants).includes(constant)) {
            constantsUsedAsVariables.push(constant)
        }
    })

    // create needToBeDefinedUpperCase
    // for val in foundConstantsNumbers, check if val is in uppercase_values
    // if not, add to needToBeDefinedUpperCase
    const needToBeDefinedUpperCase = [] // list of constants that should be defined in all uppercase
    Object.keys(foundConstantsNumbers).map((constant) => {
        if(!uppercaseValues.includes(constant)) {
            needToBeDefinedUpperCase.push(constant)
        }
    })

    return {
        'definedConstantDidntUse': definedConstantDidntUse,
        'magicNumbersNeedConstants': magicNumbersNeedConstants,
        'constantsUsedAsVariables': constantsUsedAsVariables,
        'needToBeDefinedUpperCase': needToBeDefinedUpperCase
    }
}
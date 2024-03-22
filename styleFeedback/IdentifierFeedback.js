import { callGPT3Edit } from "../../utils/gpt";
import { IDENTIFIER_INFO_KEYS, IDENTIFIER_FILTER_NAMES } from "./IdentifierPrompts";

const MAX_SCORE = 0.9


// Functions to clean and trim GPT Responses
// Gets rid of anything before the first { and after the last }
function trimResponse(response) {
    //console.log("Before trimming: ", response)
    const start = response.indexOf("{")
    const end = response.lastIndexOf("}")
    if(start === -1 || end === -1) {
        console.log("The response does not contain a JSON object")
        return
    }
    return response.substring(start, end + 1)
}

// validates the keys of the JSON object for identifier feedback
function validateIdentifierKeys(json) {
    // For each variable, ensure it has a keys: alternate_names, why (stored in constant above)
    Object.keys(json).forEach((key) => {
        const identifierInfo = json[key]
        const identifierInfoKeys = Object.keys(identifierInfo)
        IDENTIFIER_INFO_KEYS.forEach((key) => { 
            // If any of the keys are not in the identifierInfoKeys, return false
            if(!identifierInfoKeys.includes(key)) {
                return false
            }
        })
    })
    // If we get here, all the variables have all the necessary keys in their inner dictionaries
    return true
}

// filter out feedback on identifiers that we don't want to show (main, i)
function identifierFilter(json) {
    const studentIdentifiers = Object.keys(json)
    const filteredJson = {}
    studentIdentifiers.forEach((identifier) => {
        const identifierInfo = json[identifier]
        if(!IDENTIFIER_FILTER_NAMES.includes(identifier)) {
            filteredJson[identifier] = identifierInfo
        }
    })
    return filteredJson
}


// Trims the response using trimResponse fn and then parses it into a JSON object
const parseResponse = (response) => {
    const trimmedResponse = trimResponse(response)
    try {
        const parsedObject = JSON.parse(trimmedResponse);
        if (typeof(parsedObject) === 'object' && parsedObject !== null) {
          return parsedObject
        }
      } catch (error) {
        console.error('The string is not a valid JSON object.');
    }
    return undefined
}


// filter out the identifiers that have a score greater than the score passed in
function filterByScore(json, score) {
    const filteredJson = {}
    Object.keys(json).forEach((key) => {
        const identifierInfo = json[key]
        if(identifierInfo.score < score) {
            filteredJson[key] = identifierInfo
        }
    })
    return filteredJson
}


// Gets the GPT respones and parses it into a JSON object. If the JSON is not formatted correctly, 
// it will call GPT3Edit to try to fix it just once

export async function getIdentifierJsonFromGPTResponse(firstResponse) { //, validatorFn) {
    const parsedReponse = parseResponse(firstResponse)
    if(parsedReponse !== undefined) {
        const isValidResponse = validateIdentifierKeys(parsedReponse)
        if(isValidResponse) {
            const filteredOutIdentifiers = identifierFilter(parsedReponse)
            const filteredByScore = filterByScore(filteredOutIdentifiers, 0.7)
            console.log("Filtered response:", filteredByScore)
            return filteredByScore
        }
        console.log("The JSON is not formatted correctly. The keys are missing. Try again.")
    }
    console.log("The first JSON was not parseable.")
    // if we make it here, the first response was not parseable, or not valid
    const secondResponse = await callGPT3Edit('This JSON is not formatted correclty. Fix it. Give back only a JSON. Make sure that all keys are strings.', firstResponse)
    const secondParsedResponse = parseResponse(secondResponse)
    if(secondParsedResponse !== undefined) {
        const isValidResponse = validateIdentifierKeys(secondParsedResponse)
        if(isValidResponse) {
            const filteredOutIdentifiers = identifierFilter(secondParsedResponse)
            const filteredByScore = filterByScore(filteredOutIdentifiers, MAX_SCORE)
            console.log("Filtered response:", filteredByScore)
            return filteredByScore
        }
        console.log("The JSON is not formatted correctly. The keys are missing. Try again.")
    }
    console.log("Both JSONs were not parseable. Try again.")
    return 'invalid'
}
import { callGPT3Edit } from "../../utils/gpt"
import { COMMENT_INFO_KEYS } from "./CommentsPrompts";

const MAX_SCORE = 0.9

// GPT Util Functions
// TODO: move GPT util functions to another place 
function getHighestValueList(dict) {
    let result = {};
    // loop through the dictionary which is key: [[val, score]] and set resutl[key] to the list with highest score
    for (let key in dict) {
        let highestValue = null;
        let highestScore = null;
        for (let i = 0; i < dict[key].length; i++) {
            let value = dict[key][i][0];
            let score = dict[key][i][1];
            if (highestScore === null || score > highestScore) {
            highestValue = value;
            highestScore = score;
            }
        }
        result[key] = highestValue;
    }
    return result;
}

function getHighestValues(dict) {
    let result = {};
    for (let outerKey in dict) {
      let highestValue = null;
      let highestInnerKey = null;
      // check if it is empty, and include it if it is
      if (Object.keys(dict[outerKey]).length === 0) {
        result[outerKey] = {}
        continue
      }
      for (let innerKey in dict[outerKey]) {
        let innerValue = dict[outerKey][innerKey][1];
        if (highestValue === null || innerValue > highestValue) {
          highestValue = innerValue;
          highestInnerKey = innerKey;
        }
      }
      result[outerKey] = { [0]: dict[outerKey][highestInnerKey] };
    }
    return result;
}

function validateCommentKeys(json) {
    const responseKeys = Object.keys(json)
    COMMENT_INFO_KEYS.map((key) => {
        if(!responseKeys.includes(key)) {
            return false
        }})
    return true
}

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

export async function getCommentJsonFromGPTResponse(firstResponse) {
    const parsedResponse = parseResponse(firstResponse)
    if(parsedResponse !== undefined) {
        if(validateCommentKeys(parsedResponse)) {
            return parsedResponse
        }
        console.log("First didn't have the right keys...")
    }
    console.log("The first JSON was not parseable.")
    // if we make it here, the first response was not parseable, or not valid
    const secondResponse = await callGPT3Edit('This JSON is not formatted correclty. Fix it. Give back only a JSON. Make sure that all keys are strings.', firstResponse)
    const secondParsedResponse = parseResponse(secondResponse)
    if(secondParsedResponse !== undefined) {
        if(validateCommentKeys(secondParsedResponse)) {
            return secondParsedResponse
        }
        console.log("Second didn't have the right keys...")
    }
    console.log("Both JSONs were not parseable. Try again.")
    return 'invalid'
}

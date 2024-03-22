import { callStyleFeedbackRequest } from "utils/gpt";
import { studentIdentifiersPrompt, profIdentifiersPrompt } from './IdentifierPrompts.js'
import { StudentCommentsPrompt, ProfCommentsPrompt } from "./CommentsPrompts";
import { getMagicNumbersFeedback } from "./MagicNumbersFeedback.js";
import { collection, doc, getFirestore, query, limit, orderBy, onSnapshot, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useCollectionData, useDocumentData } from "react-firebase-hooks/firestore";
import { useEffect, useState } from "react";
import { getDecompFeedback } from "./DecompFeedback.js";

export const removeComments = (code) => {
    const pattern = /(\"\"\"[\s\S]*?\"\"\")|(\'\'\'[\s\S]*?\'\'\')|#[^\r\n]*|#[^\r\n]*\r?\n|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gm;
    return code.replace(pattern, "");
}

export function extractComments(program) {
    const lines = program.split('\n');
    const results = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const commentRegex = /#.*/;
        const tripleQuoteCommentRegex = /("""|''').*?(\1|$)/;
        const commentMatch = line.match(commentRegex);
        const tripleQuoteCommentMatch = line.match(tripleQuoteCommentRegex);
        if (commentMatch) {
            const commentText = commentMatch[0].replace('#', '').trim();
            results[i+1] = commentText
        }
        if (tripleQuoteCommentMatch) {
            let commentText = tripleQuoteCommentMatch[0].replace(/"""|'''/g, '').trim();
            for (let j = i + 1; j < lines.length; j++) {
                const endMatch = lines[j].match(tripleQuoteCommentRegex)
                if (endMatch !== null) {
                    results[i+1] = commentText
                    i = j
                    break;
                } else {
                    commentText += lines[j].trim();
                }
            }
        }
    }
    return results;
}

export const extractLineNumsToComments = (code) => {
    const pattern = /(\"\"\"[\s\S]*?\"\"\")|(\'\'\'[\s\S]*?\'\'\')|#[^\r\n]*|#[^\r\n]*\r?\n|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gm;
    const lines = code.split(/\r?\n/);
    const comments = {};
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = pattern.exec(line);
      if (match !== null) {
        const comment = match[0].trim();
        if (comment.startsWith('"""') || comment.startsWith("'''")) {
          // multi-line comment
          comments[i + 1] = comment;
          const endPattern = new RegExp(`${comment.endsWith('"""') ? '"""' : "'''"}`, 'g');
          for (let j = i + 1; j < lines.length; j++) {
            const endMatch = endPattern.exec(lines[j]);
            if (endMatch !== null) {
              break;
            }
          }
          i = j;
        } else {
          // single-line comment
          comments[i + 1] = comment;
        }
      }
    }
    return comments;
  };

// This function is used to extract the variables and functions from the code and create a dictionary where the key is the variable and the value is the value that variable is assigned. It stores only the last defition of each var. Functions each have key FUNC
export function extractVariables(code) {
    const variableRegex = /([a-zA-Z_]\w*)\s*=\s*(.+?)\s*(#.*)?$/gm;
    const functionRegex = /def\s+([a-zA-Z_]\w*)/gm;
    const variables = {};

    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const functionName = match[1];
      variables[functionName] = "FUNC";
    }
    
    while ((match = variableRegex.exec(code)) !== null) {
        const variableName = match[1];
        const variableValue = JSON.stringify(match[2]);
        variables[variableName] = JSON.parse(variableValue);
    }
    

    return variables;
}

// This function creates a dictionary where each key is a variable defined in the program and the value is a dictionary where the key is the line number and the value is the value that variable is assigned on that line.
export function extractVariablesToLineNums(code) {
    const variableRegex = /([a-zA-Z_]\w*)\s*=\s*(.+?)\s*(#.*)?$|([a-zA-Z_]\w*)\s*\+=\s*(.+?)\s*(#.*)?$/gm;
    const variables = {};
  
    let match;
    while ((match = variableRegex.exec(code)) !== null) {
      const variableName = match[1] || match[4];
      let variableValue = match[2] || `${variableName} + ${match[5]}`;
      variableValue = variableValue.trim()
      const lineNumber = code.substr(0, match.index).split('\n').length;
      if (!variables[variableName]) {
        variables[variableName] = {};
      }
      if(isNumericLike(variableValue)) {
        const currentValue = variables[variableName][lineNumber] || '';
        const parsed = parseFloat(variableValue)
        variables[variableName][lineNumber] = `${currentValue}${parsed}`;
      } else {
        const currentValue = variables[variableName][lineNumber] || '';
        variables[variableName][lineNumber] = `${currentValue} ${variableValue}`;
      }
    }
  
    return variables;
}

// This function is used to extract the magic numbers from the code and create a dictionary where the key is the magic number and the value is a list of line numbers that the magic number is on.
export function parsePythonNumbers(program) {
    const lines = program.split('\n');
    const results = {};
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const regex = /(?:^|[^A-Za-z_])\.?\d+(\.\d+)?\b/g; // match digits with optional decimal points not preceded by letters or underscores
      const matches = line.match(regex);
      if (matches !== null) {
        if (line.includes('=')) {
          // extract numbers on the right hand side of the equal sign
          const rhsMatches = line.split('=')[1].match(regex);
          if (rhsMatches !== null) {
            rhsMatches.forEach((num) => {
              const parsedNum = parseFloat(num);
              if (results[parsedNum]) {
                results[parsedNum].push(i+1);
              } else {
                results[parsedNum] = [i+1];
              }
            });
          }
        } else {
          // extract all numbers on the line
          matches.forEach((num) => {
            const parsedNum = parseFloat(num);
            if (results[parsedNum]) {
              results[parsedNum].push(i+1);
            } else {
              results[parsedNum] = [i+1];
            }
          });
        }
      }
    }
    return results;
}

export function isNumericLike(value) {
    return (typeof value === 'number' || typeof value === 'string') && !isNaN(value);
}

const composeMessagesAdditionalDict = (variables, code, studentPrompt, profPrompt) => {
  return [{role: "user", content: studentPrompt + "\n" + "```" + code + "```"}, {role: "system", content: profPrompt + "\n" + JSON.stringify(variables)}] // couldn't use student and prof for roles, needed to use useer and system following their examples
}

export const onStyleFeedbackClick = (code, courseId, projectId, feedbackId) => {
  const loggingLocation = 'insert_logging_location'
  const noCommentCode = removeComments(code)
  const variables = extractVariables(noCommentCode)
  const lineNumsToComments = extractComments(code)

  // Line numbers are computed for the code with no comments !! 
  const variablesToLineNums = extractVariablesToLineNums(noCommentCode)
  const magicNumsToLineNums = parsePythonNumbers(noCommentCode)

  // Create messages for each type of feedback
  const identifierMessages = composeMessagesAdditionalDict(variables, code, studentIdentifiersPrompt, profIdentifiersPrompt)
  const commentsMessages = composeMessagesAdditionalDict(lineNumsToComments, code, StudentCommentsPrompt, ProfCommentsPrompt)
  
  // Used to check how many times the user has gotten feedback for this project
  const pathToProjectFeedbackRequests = 'insert_path_to_project_feedback_requests'
  
  // Start firebase function for each type of feedback that uses GPT-3
  const promise1 = callStyleFeedbackRequest(identifierMessages, loggingLocation, "identifier", pathToProjectFeedbackRequests)
  const promise2 = callStyleFeedbackRequest(commentsMessages, loggingLocation, "comments", pathToProjectFeedbackRequests)
  
  // Need to use a promise queue here because the firebase function to check the timestamp needs to finish before the timestamp is written in logConstantsFeedback. Otherwise it takes the timestamp of itself and denies access
  Promise.all([promise1, promise2]).then(() => {
    
    // Get feedback from front end for magic numbers and decomp since these do not use GPT-3
    const magicNumbersfeedback = getMagicNumbersFeedback(variablesToLineNums, magicNumsToLineNums)
    const decompFeedback = getDecompFeedback(noCommentCode)
    
    // log magic numbers feebdack from front end because it is not sent to FB function since no GPT-3 is used 
    logNonGPTFeedback(loggingLocation, "magicNumbers", magicNumbersfeedback)
    logNonGPTFeedback(loggingLocation, "decomp", decompFeedback)
  
  }).catch((error) => {
    console.log(error)
  })
}

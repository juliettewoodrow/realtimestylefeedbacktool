export const MAX_FN_LINES = 15;

// This function parses a string of Python code into a dictionary of functions and their lines of code.
export const parseFunctionsToCode = (code) => {
    const functions = {};
  
    let currentFunctionName = null;
    let currentFunctionLines = [];
  
    const lines = code.trim().split("\n");
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Filter out any whitespace lines
      if(line === "") {
        continue
      }
  
      if (line.startsWith("def ")) {
        // start of new function
        if (currentFunctionName) {
          functions[currentFunctionName] = currentFunctionLines;
        }
  
        currentFunctionName = line.slice(4, line.indexOf("("));
        currentFunctionLines = [line];
      } else if (currentFunctionName) {
        // add line to current function
        currentFunctionLines.push(line);
      }
    }
  
    if (currentFunctionName) {
      functions[currentFunctionName] = currentFunctionLines;
    }
  
    return functions;
  };

export const checkRepeatedCode = (functionsDict) => {

    // This function checks if any two functions have > 4 lines of code in common.
    const checkFunction = (f1, f2) => {
      if (f1 === f2) {
        return false;
      }
  
      let f1Code = functionsDict[f1]
      let f2Code = functionsDict[f2]
  
      if (f1Code.length <= 4 || f2Code.length <= 4) {
        return false;
      }

      for (let i = 0; i < f1Code.length - 3; i++) {
        const currentSequence = f1Code.slice(i, i + 4);
        if (f2Code.join("").includes(currentSequence.join(""))) {
          return currentSequence;
        }
      }
      return false
    };
  
    const repeatedCode = {};
  
    const functionNames = Object.keys(functionsDict);
    for (let i = 0; i < functionNames.length; i++) {
      for (let j = i + 1; j < functionNames.length; j++) {
        const repeatedSequence = checkFunction(functionNames[i], functionNames[j]);
        if (repeatedSequence) {
          const functionName1 = functionNames[i];
          const functionName2 = functionNames[j];
          repeatedCode[`${functionName1} and ${functionName2}`] = repeatedSequence;
        }
      }
    }
  
    return repeatedCode;
  };
  
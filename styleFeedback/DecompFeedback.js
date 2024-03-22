import { checkRepeatedCode, parseFunctionsToCode, MAX_FN_LINES } from "./DecompUtils"


export function getDecompFeedback(noCommentCode) {
    const decompFunctions = parseFunctionsToCode(noCommentCode)
    const repeatedCode = checkRepeatedCode(decompFunctions)

    console.log("DECOMP FUNCTIONS", decompFunctions)
    console.log("REPEATED CODE", repeatedCode)

    // Make a list of all keys in decompFunctions which have values with lenght > 10
    const longFunctions = Object.keys(decompFunctions).filter((fnName) => {
        return decompFunctions[fnName].length > MAX_FN_LINES
    })

    return {
        'repeatedCode': repeatedCode,
        'longFunctions': longFunctions
    }
}
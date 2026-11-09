import Foundation

public enum ReadingText {
    public static func paragraphs(from source:String)->[String]{
        let text=source.replacingOccurrences(of:"\r\n",with:"\n").replacingOccurrences(of:"\r",with:"\n").replacingOccurrences(of:"([A-Za-z])-\\n([a-z])",with:"$1$2",options:.regularExpression)
        let blocks=text.replacingOccurrences(of:"\\n[ \\t]*\\n",with:"\u{001e}",options:.regularExpression).components(separatedBy:"\u{001e}")
        func cjk(_ scalar:UnicodeScalar?)->Bool{guard let scalar else{return false};return (0x3000...0x9fff).contains(scalar.value)}
        return blocks.compactMap{block in
            var result=""
            for line in block.components(separatedBy:"\n").map({$0.trimmingCharacters(in:.whitespacesAndNewlines)}).filter({!$0.isEmpty}){
                if !result.isEmpty && !(cjk(result.unicodeScalars.last)&&cjk(line.unicodeScalars.first)){result+=" "}
                result+=line
            }
            return result.isEmpty ? nil : result
        }
    }
}

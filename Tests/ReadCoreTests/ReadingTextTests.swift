import XCTest
@testable import ReadCore

final class ReadingTextTests:XCTestCase {
    func testPDFLineWrappingAndHyphenationDoNotBecomeHardReaderBreaks(){
        XCTAssertEqual(ReadingText.paragraphs(from:"A dif-\nferent way\nto read.\n\nAnother thought."),["A different way to read.","Another thought."])
    }
    func testJapaneseTextKeepsItsScriptWithoutInsertedWordSpaces(){
        XCTAssertEqual(ReadingText.paragraphs(from:"日本語の\n読みやすい文章。"),["日本語の読みやすい文章。"])
    }
}

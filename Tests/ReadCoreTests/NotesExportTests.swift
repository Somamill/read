import XCTest
@testable import ReadCore

final class NotesExportTests:XCTestCase {
    func testBooksAndArticlesKeepTheirPassageNotesTagsAndReaderLinks(){
        let output=NotesExport.text(for:[["id":"book-note","title":"本の名前","author":"著者","text":"大切な言葉。","note":"My thought","tags":["reading"]],["id":"article-note","title":"An essay","text":"<This stays literal>"]])
        XCTAssertTrue(output.contains("大切な言葉。"));XCTAssertTrue(output.contains("Note: My thought"));XCTAssertTrue(output.contains("#reading"));XCTAssertTrue(output.contains("shelf://highlight/article-note"));XCTAssertTrue(output.contains("<This stays literal>"))
    }
}

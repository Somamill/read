import Foundation

public enum NotesExport {
    public static func text(for items:[[String:Any]])->String {
        items.map { item in
            let title=item["title"] as? String ?? "Untitled"
            let author=item["author"] as? String ?? ""
            let passage=item["text"] as? String ?? ""
            let note=item["note"] as? String ?? ""
            let tags=(item["tags"] as? [String] ?? []).map{"#"+$0}.joined(separator:" ")
            let identifier=(item["id"] as? String ?? "").addingPercentEncoding(withAllowedCharacters:.urlPathAllowed) ?? ""
            return [title,author,passage,note.isEmpty ? "" : "Note: "+note,tags,identifier.isEmpty ? "" : "Open in read.: shelf://highlight/"+identifier].filter{!$0.isEmpty}.joined(separator:"\n\n")
        }.joined(separator:"\n\n———\n\n")
    }
}

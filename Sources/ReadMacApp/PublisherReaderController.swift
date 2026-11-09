import AppKit
import WebKit

/// Publisher fallback has no native message handlers or access to reader credentials.
final class PublisherReaderController:NSViewController,WKNavigationDelegate,WKUIDelegate {
    private let url:URL
    private let capture:([String:Any])->Void
    private let back:()->Void
    private let openLink:(String)->Void
    private let world=WKContentWorld.world(name:"read.publisher.capture")
    private var web:WKWebView!
    private let status=NSTextField(labelWithString:"Loading publisher view…")
    private var captured=false
    init(url:URL,capture:@escaping([String:Any])->Void,back:@escaping()->Void,openLink:@escaping(String)->Void) {
        self.url=url;self.capture=capture;self.back=back;self.openLink=openLink
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) is not supported")}
    override func loadView(){
        view=NSView(frame:NSRect(x:0,y:0,width:1000,height:720));view.autoresizingMask=[.width,.height]
        let config=WKWebViewConfiguration();config.websiteDataStore = .nonPersistent()
        let resources=Bundle.main.resourceURL!
        let files=["Vendor/Readability.js","Vendor/purify.min.js","article-extraction.js"]
        let script=files.compactMap{try? String(contentsOf:resources.appendingPathComponent($0),encoding:.utf8)}.joined(separator:"\n")
        config.userContentController.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentEnd,forMainFrameOnly:true,in:world))
        web=WKWebView(frame:.zero,configuration:config);web.navigationDelegate=self;web.uiDelegate=self;web.translatesAutoresizingMaskIntoConstraints=false
        let goBack=NSButton(title:"Back",image:NSImage(systemSymbolName:"chevron.left",accessibilityDescription:nil)!,target:self,action:#selector(close));goBack.bezelStyle = .rounded
        let reader=NSButton(title:"Reader mode",image:NSImage(systemSymbolName:"doc.text",accessibilityDescription:nil)!,target:self,action:#selector(extract));reader.bezelStyle = .rounded
        status.font = .systemFont(ofSize:12);status.textColor = .secondaryLabelColor;status.lineBreakMode = .byTruncatingMiddle
        let row=NSStackView(views:[goBack,status,reader]);row.spacing=14;row.translatesAutoresizingMaskIntoConstraints=false
        view.addSubview(row);view.addSubview(web)
        NSLayoutConstraint.activate([row.topAnchor.constraint(equalTo:view.topAnchor,constant:48),row.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:20),row.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-20),row.heightAnchor.constraint(equalToConstant:36),web.topAnchor.constraint(equalTo:row.bottomAnchor,constant:10),web.leadingAnchor.constraint(equalTo:view.leadingAnchor),web.trailingAnchor.constraint(equalTo:view.trailingAnchor),web.bottomAnchor.constraint(equalTo:view.bottomAnchor)])
        web.load(URLRequest(url:url))
    }
    @objc private func close(){web.stopLoading();back()}
    @objc private func extract(){
        guard !captured else{return}
        status.stringValue="Preparing readable text…"
        web.evaluateJavaScript("JSON.stringify(extractSavedArticle(document.documentElement.outerHTML,document.URL))",in:nil,in:world){[weak self] result in
            guard let self else{return}
            if case .success(let value)=result,let text=value as? String,let data=text.data(using:.utf8),let item=try? JSONSerialization.jsonObject(with:data) as? [String:Any]{self.captured=true;self.capture(item)}
            else{self.status.stringValue="Publisher view · Try Reader mode after the page loads."}
        }
    }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){status.stringValue=url.host ?? "Publisher view";DispatchQueue.main.asyncAfter(deadline:.now()+0.6){[weak self] in self?.extract()}}
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){
        guard let target=action.request.url,["http","https"].contains(target.scheme ?? "") else{decisionHandler(.cancel);return}
        if action.navigationType == .linkActivated{decisionHandler(.cancel);openLink(target.absoluteString)}else{decisionHandler(.allow)}
    }
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for action:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView?{if let url=action.request.url{openLink(url.absoluteString)};return nil}
}

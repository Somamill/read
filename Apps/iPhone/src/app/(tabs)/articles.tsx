import { useState, useCallback, useEffect } from "react";
import { Alert, Image, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useRead } from "../../lib/context";
import { Page, Card, Label, Button, Field } from "../../components/UI";
import { subscribe, suggestions } from "../../lib/feeds";
import { remove, list, put } from "../../lib/storage";
import { compile } from "../../lib/reading-views";
import { md5 } from "js-md5";
type ReadingView = {id: string; name: string; query: string};
export default function Articles() {
  const { books, highlights, feeds, reload, report, saveProgress, saveBook } = useRead();
  const [details,setDetails]=useState<{id:string;tags:string}|null>(null);
  const [views,setViews]=useState<ReadingView[]>([]),[viewName,setViewName]=useState("");
  const [showViews,setShowViews]=useState(false),[selection,setSelection]=useState<string[]>([]),[selecting,setSelecting]=useState(false),[bulkBusy,setBulkBusy]=useState(false);
  const [visible, setVisible] = useState(40);
  const [url, setURL] = useState(""),
    [feed, setFeed] = useState(""),
    [query, setQuery] = useState(""),
    [finished, setFinished] = useState(false);
  useEffect(()=>{list<ReadingView>("reading-view").then(setViews).catch(report)},[report]);
  const saveView=async()=>{try{compile(query);if(views.some(x=>x.name===viewName.trim()&&x.query===query.trim())){Alert.alert("Reading view","This view is already saved.");return}if(!query.trim()||!viewName.trim())throw new Error("Add a view name and filter query.");if(viewName.length>80||views.length>=100)throw new Error("Keep up to 100 views with names under 80 characters.");const view={id:md5(viewName.trim()+"\n"+query.trim()),name:viewName.trim(),query:query.trim()};await put("reading-view",view.id,view);setViews(await list<ReadingView>("reading-view"));setViewName("")}catch(e){Alert.alert("Reading view",(e as Error).message)}};
  const bulk=async(finished:boolean)=>{if(bulkBusy)return;setBulkBusy(true);try{for(const id of selection.slice(0,200))await saveProgress(id,finished?1:0);setSelection([]);setSelecting(false)}catch(e){report(e);Alert.alert("Inbox action",(e as Error).message)}finally{setBulkBusy(false)}};
  const feedURLs = JSON.stringify(feeds.map((f) => f.url));
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        for (const url of JSON.parse(feedURLs) as string[])
          try {
            await subscribe(url);
          } catch {}
        if (active) await reload();
      })();
      return () => {
        active = false;
      };
    }, [feedURLs, reload]),
  );
  const follow = async (u: string) => {
    try {
      await subscribe(u, true);
      await reload();
      setFeed("");
    } catch (e) {
      report(e);
      Alert.alert("Feed unavailable", (e as Error).message);
    }
  };
  let queryError="",matches: (item:unknown)=>boolean=()=>true;
  try{matches=compile(query)}catch(e){queryError=(e as Error).message;matches=()=>false}
  const highlightCounts=new Map<string,number>();for(const note of highlights)if(!note.archived)highlightCounts.set(note.bookId,(highlightCounts.get(note.bookId)||0)+1);
  const filteredArticles=books.filter(b=>b.kind==="article"&&(query.trim()||b.finished===finished)&&matches({...b,highlightCount:highlightCounts.get(b.id)||0}));
  return (
    <Page title="Articles" subtitle="A quieter home for the web.">
      <Card>
        <Field
          label="Article URL"
          placeholder="https://…"
          value={url}
          onChange={setURL}
        />
        <Button
          title="Save & read"
          icon="add"
          onPress={() => {
            if (url) router.push({ pathname: "/capture", params: { url } });
          }}
        />
      </Card>
      <Field label="Search articles" value={query} onChange={value=>{setQuery(value);setVisible(40)}} placeholder='tag:science OR read:<15' />
      {!!queryError&&<Label small>{queryError}</Label>}
      <Button secondary title="Reading views" icon="filter-outline" onPress={()=>setShowViews(!showViews)} />
      {showViews&&<Card><Label>Saved reading views</Label><Label small>Try is:unread, author:&quot;Martha Wells&quot;, type:pdf, or saved:7d. Views stay on this device and are included in backups.</Label>
      <Field label="View name" value={viewName} onChange={setViewName}/><Button title="Save current view" onPress={saveView}/>
      {views.map(view=><View key={view.id} style={{gap:8,paddingVertical:12}}><Button secondary title={view.name} onPress={()=>setQuery(view.query)}/><Label small>{view.query}</Label><Button secondary title="Remove view" onPress={async()=>{try{await remove("reading-view",view.id);setViews(await list<ReadingView>("reading-view"))}catch(e){report(e)}}}/></View>)}
      </Card>}
      <Button secondary title={selecting?"Cancel selection":"Select articles"} onPress={()=>{setSelecting(!selecting);setSelection([])}}/>
      {selecting&&<Card><Label>{selection.length} selected</Label><Button secondary title="Select shown" onPress={()=>setSelection(filteredArticles.slice(0,Math.min(visible,200)).map(x=>x.id))}/><Button title="Mark finished" disabled={!selection.length||bulkBusy} onPress={()=>bulk(true)}/><Button secondary title="Move to inbox" disabled={!selection.length||bulkBusy} onPress={()=>bulk(false)}/></Card>}

      <Button
        secondary
        title={finished ? "Show inbox" : "Show finished"}
        onPress={() => setFinished(!finished)}
      />
      {filteredArticles.slice(0, visible).map((b) => (
        <Card key={b.id}>
          {selecting&&<Button secondary title={selection.includes(b.id)?"Selected":"Select article"} icon={selection.includes(b.id)?"checkbox-outline":"square-outline"} onPress={()=>setSelection(previous=>previous.includes(b.id)?previous.filter(x=>x!==b.id):previous.length<200?[...previous,b.id]:previous)}/>}

          {b.cover && (
            <Image
              source={{ uri: b.cover }}
              style={{ width: "100%", height: 150, borderRadius: 12 }}
            />
          )}
          <Label>{b.title}</Label>
          <Button secondary title="Details" onPress={()=>setDetails(details?.id===b.id?null:{id:b.id,tags:(b.tags||[]).join(", ")})}/>
          {details?.id===b.id&&<View style={{gap:12,paddingVertical:12}}><Label small>{b.sourceURL||"Saved on this device"}</Label><Field label="Tags, separated by commas" value={details.tags} onChange={tags=>setDetails({id:b.id,tags})}/><Button secondary title="Save tags" onPress={async()=>{try{await saveBook({...b,tags:details.tags.split(",").map(x=>x.trim()).filter(Boolean).slice(0,50)});setDetails(null)}catch(e){report(e)}}}/><Button secondary title={b.favorite?"Unstar":"Star"} icon={b.favorite?"star":"star-outline"} onPress={()=>saveBook({...b,favorite:!b.favorite}).catch(report)}/></View>}

          <Label small>
            {b.author} ·{" "}
            {b.hasContent || b.html ? "Saved offline" : "Feed preview"}
          </Label>
          <Button
            title={b.progress ? "Continue reading" : "Read"}
            onPress={() =>
              router.push(
                b.hasContent || b.html || b.readerID
                  ? { pathname: "/reader", params: { id: b.id } }
                  : {
                      pathname: "/capture",
                      params: { url: b.sourceURL!, existing: b.id },
                    },
              )
            }
          />
          <Button
            secondary
            title={b.finished ? "Move to inbox" : "Mark finished"}
            onPress={() => saveProgress(b.id, b.finished ? 0 : 1).catch(report)}
          />
        </Card>
      ))}
      {filteredArticles.length > visible && (
        <Button
          secondary
          title="Show more articles"
          onPress={() => setVisible(visible + 40)}
        />
      )}
      <Card>
        <Label>RSS & Atom</Label>
        <Field
          label="Feed address"
          value={feed}
          onChange={setFeed}
          placeholder="https://…/feed"
        />
        <Button title="Subscribe" onPress={() => follow(feed)} />
        {feeds.map((f) => (
          <Card key={f.url}>
            <Label>{f.title}</Label>
            <Label small>{new Date(f.checked).toLocaleString()}</Label>
            <Button
              secondary
              title="Unsubscribe"
              onPress={async () => {
                await remove("feed", f.url);
                await reload();
              }}
            />
          </Card>
        ))}
      </Card>
      <Card>
        <Label>Discover feeds</Label>
        <Label small>
          Curated independent writing. Follow only the sources you want.
        </Label>
        {suggestions
          .filter(([, u]) => !feeds.some((f) => f.url === u))
          .map(([title, u]) => (
            <Button
              secondary
              key={u}
              title={"Follow " + title}
              onPress={() => follow(u)}
            />
          ))}
      </Card>
    </Page>
  );
}

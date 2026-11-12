import { useState } from "react";
import { router } from "expo-router";
import { useRead } from "../lib/context";
import { Page, Card, Label, Button, Field } from "../components/UI";
import { compile } from "../lib/reading-views";

export default function Search() {
  const { books, highlights } = useRead();
  const [query, setQuery] = useState("");
  let error = "", matches: (item: unknown) => boolean = () => true;
  try { matches = compile(query); } catch (e) { error = (e as Error).message; matches = () => false; }
  const counts=new Map<string,number>();for(const note of highlights)if(!note.archived)counts.set(note.bookId,(counts.get(note.bookId)||0)+1);
  const found = query.trim() ? books.filter(book=>matches({...book,highlightCount:counts.get(book.id)||0})).slice(0, 40) : [];
  return <Page title="Search" subtitle="Books, articles and local actions." searchable={false}>
    <Field label="Find something to read" value={query} onChange={setQuery} placeholder='Title, author, type:epub or is:reading' />
    {!!error && <Label small>{error}</Label>}
    <Card><Label>Go to</Label>
      <Button secondary title="Library" icon="book-outline" onPress={() => router.replace("/(tabs)")} />
      <Button secondary title="Articles and saved views" icon="newspaper-outline" onPress={() => router.replace("/(tabs)/articles")} />
      <Button secondary title="Highlights and review" icon="pencil-outline" onPress={() => router.replace("/(tabs)/highlights")} />
      <Button secondary title="Connections and settings" icon="options-outline" onPress={() => router.replace("/(tabs)/connections")} />
    </Card>
    {found.map(book => <Card key={book.id}><Label>{book.title}</Label><Label small>{book.author}</Label><Button title={book.uri||book.hasContent||book.html||book.readerID||book.calibre&&Object.keys(book.calibre.formats).length?"Open":book.kind==="article"&&book.sourceURL?"Save and read":"File not available"} disabled={!(book.uri||book.hasContent||book.html||book.readerID||book.calibre&&Object.keys(book.calibre.formats).length||book.kind==="article"&&book.sourceURL)} onPress={() => router.push(book.kind==="article"&&!book.hasContent&&!book.html&&!book.readerID&&book.sourceURL?{pathname:"/capture",params:{url:book.sourceURL,existing:book.id}}:{pathname:"/reader",params:{id:book.id}})} /></Card>)}
    {!!query.trim()&&!error&&!found.length&&<Label>No local items match. Try a title, author, or type:article.</Label>}
    <Button secondary title="Go back" onPress={() => router.back()} />
  </Page>;
}

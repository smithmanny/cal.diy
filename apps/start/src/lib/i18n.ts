import { useMatches } from "@tanstack/react-router";

type LoaderDataWithMessages = { messages?: Messages } | undefined;

export type Messages = Record<string, string>;

export type TFunction = (key: string, values?: Record<string, string | number>) => string;

export function createT(messages: Messages): TFunction {
  return (key, values) => {
    const template = messages[key] ?? key;
    if (!values) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match
    );
  };
}

/** Translates with the messages loaded by every matched route (layouts and the page). */
export function useT(): TFunction {
  const matches = useMatches();
  const messages: Messages = {};
  for (const match of matches) {
    Object.assign(messages, (match.loaderData as LoaderDataWithMessages)?.messages);
  }
  return createT(messages);
}

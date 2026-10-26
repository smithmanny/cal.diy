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

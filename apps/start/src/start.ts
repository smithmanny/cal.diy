import { createStart } from "@tanstack/react-start";
import { errorMiddleware } from "./server/errorMiddleware";

export const startInstance = createStart(() => ({
  functionMiddleware: [errorMiddleware],
}));

import { defineEventHandler, getRequestURL, setHeader } from "h3";
import { setEventRequestContext } from "../lib/request-context";
import { getOrCreateRequestId, getOrCreateTraceId } from "../lib/trace";
import { logEvent } from "../lib/observability";

export default defineEventHandler((event) => {
  const requestId = getOrCreateRequestId(event);
  const traceId = getOrCreateTraceId(event);
  const url = getRequestURL(event);

  setHeader(event, "x-request-id", requestId);
  setHeader(event, "x-trace-id", traceId);

  setEventRequestContext(event, {
    requestId,
    traceId,
    method: event.method,
    path: url.pathname,
    route: event.path,
  });

  logEvent({
    event: "http.request.received",
    data: {
      requestId,
      traceId,
      method: event.method,
      path: url.pathname,
      route: event.path,
      query: Object.fromEntries(url.searchParams.entries()),
    },
  });
});

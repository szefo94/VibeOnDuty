# Phase 01 API coverage

Recorded on 2026-10-04 before conversational UAT. This phase integrates the
self-hosted Colyseus SDK; it does not connect to a hosted Colyseus service.
The inventory covers the installed SDK's exported capability families and the
companion server APIs used by this two-client authoritative TDM slice.
Protected implementation methods and type-only exports do not represent separate
product capabilities. Related overloads share their capability row.

Reviewed local declarations: `@colyseus/sdk` 0.18.4 (`Client.d.ts`, `Room.d.ts`,
`index.d.ts`) and `@colyseus/core` 0.18.18 (`Server.d.ts`). Companion packages are
`@colyseus/schema` 5.0.35 and `@colyseus/ws-transport` 0.18.4. These are the
installed versions, not a recommendation to upgrade.

Decisions below apply to Phase 01 only. OPT-OUT records a deliberate scope boundary;
it does not cancel the roadmap's lobbies, reconnect/prediction, identity, bots or
hardware qualification work. INTEGRATE records existing source behavior and is
not a manual acceptance result.

| capability | decision | reason |
| --- | --- | --- |
| Client constructor and endpoint settings | INTEGRATE | Construct Client with location.origin so the operator's advertised server also serves the game and matchmaking. |
| Client headers, URL builder and fetch override options | OPT-OUT | Same-origin browser defaults suffice; no custom proxy or header credential contract exists in this slice. |
| WebSocket protocol | INTEGRATE | Use the pinned WebSocket transport with TLS when requested by the operator. |
| Experimental h3/WebTransport protocol | OPT-OUT | No h3 server transport or supported-device qualification is planned in Phase 01. |
| Client.joinOrCreate | INTEGRATE | Enter TDM through the SDK; the server admission handler reserves seats only in the single operator-created room. |
| Client.create | OPT-OUT | Public room creation would bypass the single-room admission boundary; player-created lobbies belong to the later lobby phase. |
| Client.join | OPT-OUT | The current entry uses joinOrCreate routed to the operator room; a second browser admission path adds no required behavior. |
| Client.joinById | OPT-OUT | Players open one server link and do not select room IDs in Phase 01; room selection belongs to lobbies. |
| Client.consumeSeatReservation | INTEGRATE | SDK matchmaking consumes the bounded seat reservation returned by the operator-room admission route; application code does not manufacture reservations. |
| Client.reconnect and Room reconnection tokens/options | OPT-OUT | Automatic reconnection is disabled; Retry creates a fresh membership and resets session-owned state. Reconnection continuity needs the later netcode contract. |
| Client.selectByLatency and Client.getLatency | OPT-OUT | The player explicitly connects to one deployed server; server selection and latency measurement are outside this slice. |
| Client.http generic HTTP API | OPT-OUT | No additional SDK HTTP product routes are needed beyond its matchmaking implementation; readiness is a first-party server endpoint. |
| Auth authentication, identity, popup and password flows | OPT-OUT | Phase 01 uses ephemeral room sessions. Account identity and progression require a later product decision and must not be implied by a session ID. |
| Room construction and connect | INTEGRATE | SDK admission constructs and connects the room using its reservation, rather than application-created transport endpoints. |
| Room identity, sessionId and connection.isOpen | INTEGRATE | Bind authoritative player state and callback ownership to the joined session; avoid waiting for a leave acknowledgement on a closed connection. |
| Room.state and SchemaSerializer | INTEGRATE | Decode server schema patches and read authoritative players, life/match generations, ammunition, scores and match timers. |
| Room.onStateChange | OPT-OUT | The render loop reads the decoded current state directly; an additional state-change subscription is not necessary for this renderer. |
| Room.onMessage | INTEGRATE | Receive input rejection, team rejection and recipient-private confirmed-hit messages. |
| Room.onError and Room.onLeave | INTEGRATE | Surface connection errors and disconnections at the top of the screen; callbacks check their owning room. |
| Room.onReconnect and Room.onDrop | OPT-OUT | Automatic reconnection is disabled and the current lifecycle handles errors and leave explicitly. |
| Room.send reliable messages | INTEGRATE | Send sequenced movement/combat intents and generation-bound team-switch requests for server validation. |
| Room.send response callbacks and Room.request | OPT-OUT | The protocol uses state patches and named rejection/confirmation messages; no request-response RPC is required. |
| Room.sendUnreliable | OPT-OUT | This WebSocket acceptance slice uses reliable transport; alternative delivery needs later loss and prediction policies. |
| Room.sendBytes | OPT-OUT | The validated named-message protocol has no binary application message contract. |
| Room.ping | OPT-OUT | A latency HUD or network quality acceptance target is not part of Phase 01. |
| Room.input, InputHandle and RoomClock | OPT-OUT | The implemented protocol owns bounded intent queues and server tick acknowledgements; adopting SDK delta-input timing requires the later prediction design. |
| Room.leave | INTEGRATE | Explicit leave, menu return and stale asynchronous joins retire their room memberships. |
| Room.removeAllListeners | OPT-OUT | Retired rooms are discarded and callbacks are guarded by current-room ownership; blanket listener removal is not needed by the existing cleanup path. |
| ServerError, AbortError, MatchMakeError and protocol/close/error constants | INTEGRATE | SDK admission and connection errors are caught and shown through the existing error UI; no new application-specific error taxonomy is exposed. |
| registerSerializer and custom serializers | OPT-OUT | Standard schema serialization already carries the required state; a custom wire format would require a separate compatibility contract. |
| getStateCallbacks and Callbacks | OPT-OUT | Current rendering reads room.state rather than subscribing to schema collection callbacks. |
| Predict, Reconciler and SimReconciler | OPT-OUT | Client prediction and reconciliation are later netcode work; Phase 01 presents server-owned outcomes. |
| PredictedSpawns | OPT-OUT | Authoritative projectiles and hit recognition are implemented without speculative client spawns; prediction needs later combat reconciliation policies. |
| Server construction, transport attachment and listen | INTEGRATE | The operator CLI builds HTTP/TLS hosting and a WS transport, then listens on the requested host and port. |
| Server.define and Room creation/join/leave lifecycle | INTEGRATE | Register TDM, initialize authoritative schema/simulation, admit bounded clients, and remove departed players. |
| matchMaker.createRoom, joinById and createAuthContext | INTEGRATE | Create one operator room and reserve seats through approved-origin, bounded HTTP admission. |
| Other public matchmaking allocation and room browsing operations | OPT-OUT | Public creation and arbitrary room allocation are denied; lobby lists and configurable lobby creation belong to the next scope. |
| Room schema state, simulation interval and patch rate | INTEGRATE | Keep a 30 Hz authoritative simulation and 20 Hz patch cadence with replicated server outcomes. |
| Server Room.onMessage and recipient client.send | INTEGRATE | Validate intents and team requests; confirmed hits go only to their shooter after the relevant patch, with membership/life rechecks. |
| Server Room broadcast application messages | OPT-OUT | Shared outcomes use schema patches; hit-confirmation feedback must remain recipient-private. |
| Server reconnection/allowReconnection | OPT-OUT | Fresh-membership Retry is the accepted lifecycle for this slice; no retained reconnect seat is promised. |
| Server.gracefullyShutdown | INTEGRATE | Operator shutdown closes transport and rooms through the SDK lifecycle. |
| Server.onShutdown and onBeforeShutdown callbacks | OPT-OUT | No durable external service or extra shutdown work requires application callbacks in this process. |
| Server.removeRoomType and runtime handler mutation | OPT-OUT | The operator starts a fixed TDM room type; dynamic mode registration is unnecessary here. |
| Server.simulateLatency | OPT-OUT | This phase does not claim prediction, WAN latency tolerance or a network benchmark; these need later targeted qualification. |
| Server.serverless and standalone matchmaking deployment | OPT-OUT | The accepted deployment is one persistent self-hosted Node process started from the console. |
| Distributed presence, matchmaking driver and process selection | OPT-OUT | Multi-process scaling is outside the single-server slice and must not imply qualified slot capacity. |
| Built-in database, account auth and custom SDK route services | OPT-OUT | No durable accounts or database-backed product API is required; Express supplies bounded first-party readiness and game hosting. |
| Server development mode and custom logger configuration | OPT-OUT | The operator CLI provides current diagnostics; hot room restoration and a new logging contract are not acceptance requirements. |

## Implementation and validation evidence

- `src/network/onlineSession.js`: SDK entry, state projection, reliable intents,
  private confirmation handling, error/leave callbacks and fresh-membership cleanup.
- `server/index.js`: single-room admission, approved origins, reservation routing,
  HTTP/TLS game hosting, transport startup and graceful shutdown.
- `server/tdmRoom.js`: room lifecycle, schema definitions and replication,
  bounded intent handling and recipient-private feedback staging.
- `01-CLOSEOUT.md`, `01-VALIDATION.md` and `01-VERIFICATION.md`: existing automated
  evidence and remaining human acceptance checks. This documentation addition
  does not rerun or extend those test claims.
- `01-UAT.md`: actual certificate trust, browser gestures and gameplay review
  remain pending; no SDK decision above pre-approves those checks.

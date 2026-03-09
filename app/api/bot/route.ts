Failed to compile.
22:55:18 
22:55:18 
./app/api/gate/route.ts:157:9
22:55:18 
Type error: Object literal may only specify known properties, and 'tokenHash' does not exist in type '(Without<SessionCreateInput, SessionUncheckedCreateInput> & SessionUncheckedCreateInput) | (Without<...> & SessionCreateInput)'.
22:55:18 
22:55:18 
  155 |       data: {
22:55:18 
  156 |         userId: user.id,
22:55:18 
> 157 |         tokenHash,
22:55:18 
      |         ^
22:55:18 
  158 |         token: rawToken,
22:55:18 
  159 |         expiresAt,
22:55:18 
  160 |       },
22:55:18 
Error: Command "npm run build" exited with 1
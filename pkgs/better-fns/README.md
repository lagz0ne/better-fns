# better-fns

A super idomatic way to improve function, and keeping it fun

# why better-fn?

In general, `better-fn` aims to provide more meaninful ways to form a workflow using function. If we recall correctly, forming a flow using functions are quite limited
`better-fn` utilizes AsyncLocalstorage to create magic wrapper, and to enhance normal DX, hence "better"

## How better it is?

### defer
Similar to golang, you can use `defer` to execute a function call at the end of the execution. Isn't that perfect for cleaning up resources, closing connections?
```typescript
const connection = await acquireConnection()
defer(() => connection.close())
```

### onError
Has a chance to be aware of error. OnError doesn't stop error from being thrown

```typescript
const transaction = await acquireTransaction()

onError(e => transaction.rollback())
await transaction.submit()
```

### onSuccess
As the name recalled, to be executed on accomplished flow

## And more?

Heavily inspired by temporal.io API, `better-fns` aim to orchestrate workflow. 
Simply put, workflow is a combination of a bunch of function calls, and we'll likely want to know a lot of details in between

Isn't that the reason why we have wordings like "instrumental", or "tracing"

`better-fns` turn a normal function into a meaningful matter just overnight

```typescript
function greet(words: string) {
  console.log(words)
  defer(() => console.log("it is really a happy day"))
}

function goodbye() {
  console.log("cruel world")
}

const activities = defineSteps({
  greet, goodbye
})

// and woala, those 
const { state, value, error } = await flow(() => {
  await greet("world")
  await goodbye()
}, {
  middlewares: [logging(), tracing(), collectMetrics("performance")]
})
```

and we have bunch of middleware to enrich the experience of the call even further

example of a middleware looks like this, that's the result of running `poke-download`
```
[16:04:07.866] INFO (pikachu.retrieve pokemon from db): started {"params":["pikachu","/home/lagz0ne/better-function/examples/poke-download/database"]}
[16:04:07.876] INFO (pikachu.retrieve pokemon from db): completed {"duration":10}
[16:04:07.877] INFO (pikachu.flow): started {"module":"pikachu.flow","params":[]}
[16:04:07.877] INFO (pikachu.get sprite): started {"module":"pikachu.get sprite","params":["https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png","/home/lagz0ne/better-function/examples/poke-download/database","pikachu-front-default"]}
[16:04:07.912] INFO (pikachu.get sprite): started {"module":"pikachu.get sprite","params":["https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png","/home/lagz0ne/better-function/examples/poke-download/database","pikachu-back-default"]}
[16:04:07.914] INFO (pikachu.get sprite): started {"module":"pikachu.get sprite","params":["https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/25.png","/home/lagz0ne/better-function/examples/poke-download/database","pikachu-front-shiny"]}
[16:04:07.915] INFO (pikachu.get sprite): started {"module":"pikachu.get sprite","params":["https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/25.png","/home/lagz0ne/better-function/examples/poke-download/database","pikachu-back-shiny"]}
[16:04:07.863] INFO (pikachu.flow): started {"params":["pikachu"]}
[16:04:07.864] INFO (pikachu.guarantee the output dir): started {"params":["/home/lagz0ne/better-function/examples/poke-download/database"]}
[16:04:07.864] INFO (pikachu.guarantee the output dir): completed {"duration":0}
[16:04:07.865] INFO (pikachu.check availabiltity): started {"params":["pikachu","/home/lagz0ne/better-function/examples/poke-download/database"]}
[16:04:07.865] INFO (pikachu.check availabiltity): completed {"duration":0}
[16:04:08.270] INFO (pikachu.get sprite): completed {"duration":393,"module":"pikachu.get sprite"}
[16:04:08.523] INFO (pikachu.get sprite): completed {"duration":608,"module":"pikachu.get sprite"}
[16:04:08.530] INFO (pikachu.get sprite): completed {"duration":616,"module":"pikachu.get sprite"}
[16:04:08.535] INFO (pikachu.get sprite): completed {"duration":623,"module":"pikachu.get sprite"}
[16:04:08.535] INFO (pikachu.flow): completed {"duration":658,"module":"pikachu.flow"}
[16:04:08.535] INFO (pikachu.flow): completed {"duration":672}
```

### Give this a try 🚀
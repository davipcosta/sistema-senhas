# Sistema de Senhas — DPE-PA

Sistema de gerenciamento de filas e chamada de senhas para atendimento presencial da Defensoria Pública do Estado do Pará (DPE-PA). Roda em um único servidor Node.js na rede local e sincroniza em tempo real o totem de emissão, os guichês, o painel de TV e o acompanhamento pelo celular.

## Funcionalidades

- **Emissão de senhas por setor**: Vara Criminal (`CRIM`), Família (`FAM`) e Execução Penal (`PEN`), com numeração sequencial (`CRIM-001`, `FAM-002`…).
- **Três categorias de atendimento**: Normal, Prioridade Legal (gestantes, lactantes, PCD, 60+) e Idoso (80+).
- **Chamada com regra de prioridade** aplicada no servidor (veja [Regras de chamada](#regras-de-chamada)).
- **Painel de TV** com gongo e anúncio por voz (TTS em português), com os áudios guardados em cache local.
- **QR Code na senha** para o cidadão acompanhar a fila pelo celular, na mesma rede Wi-Fi.
- **Sincronização em tempo real** via WebSocket nativo (`ws`) e Socket.IO.
- **Estado salvo em disco** (`data/state.json`): filas, contadores e histórico continuam após reiniciar o servidor.
- **Intervalo mínimo de 8 segundos entre chamadas do mesmo setor**, para não sobrepor anúncios.

## Telas

A raiz (`/`) abre uma página inicial com links para todas as telas e o endereço de acesso pela rede local.

| Tela | URL | Uso |
|---|---|---|
| Início | `/` | Escolha da tela que o dispositivo vai exibir. |
| Totem | `/totem.html` | O cidadão escolhe o setor e o tipo de atendimento e recebe a senha com QR Code. |
| Guichê | `/guiche.html` | O atendente escolhe o setor e o número do guichê (01–05), chama a próxima senha, rechama uma senha do histórico e pode zerar o sistema. |
| Painel | `/painel.html` | TV da sala de espera. Mostra a senha atual e as últimas chamadas do setor escolhido e anuncia por voz. |
| Cliente | `/cliente.html?ticket=CRIM-001` | Acompanhamento pelo celular: posição na fila, status da senha e chamada atual. Também tem um campo de busca. |

> **Áudio do painel:** os navegadores bloqueiam som automático. Depois de abrir o painel, clique ou toque na tela uma vez para liberar o gongo e a voz.

## Requisitos

- Node.js 18 ou superior
- Acesso à internet no servidor para gerar áudios ainda não guardados em cache (usa o Google Translate TTS) e no totem para carregar a biblioteca de QR Code via CDN. Se o CDN falhar, o QR Code é gerado por `api.qrserver.com`.

## Instalação e execução

```bash
npm install
npm start
```

Ao iniciar, o servidor mostra o endereço de acesso na rede local:

```
[Servidor] DPE-PA rodando na porta 3000
[Acesso Rede] http://192.168.0.10:3000
```

Para usar outra porta:

```bash
PORT=8080 npm start
```

O servidor escuta em `0.0.0.0`, então os outros dispositivos da rede (totem, TVs, guichês, celulares) acessam pelo IP mostrado acima. Esse mesmo IP vai no QR Code da senha, que é obtido de `/api/info`.

## Regras de chamada

Ao chamar a próxima senha, o servidor considera só as senhas do setor escolhido no guichê e segue esta ordem:

1. Enquanto o contador de preferenciais for menor que 2 e houver senha preferencial, chama uma preferencial. **Idoso (80+) vem antes de Prioridade Legal.**
2. Depois de 2 preferenciais seguidas, chama uma **Normal** (se houver) e zera o contador.
3. Sem senhas normais, continua chamando preferenciais.

Resultado: proporção de **2 preferenciais para 1 normal**, sem deixar o guichê parado quando uma das filas está vazia.

O histórico guarda as **5 últimas chamadas de cada setor**. Rechamar uma senha coloca ela de novo no topo e repete o anúncio no painel.

> `shared.js` repete essa mesma regra no navegador, como reserva para quando a API REST não responde.

## API

### REST

| Método | Rota | Corpo | Descrição |
|---|---|---|---|
| `GET` | `/api/state` | — | Estado completo (filas, contadores, chamada atual, histórico). |
| `POST` | `/api/tickets` | `{ service, category, prefix }` | Emite uma nova senha. |
| `POST` | `/api/call` | `{ desk, serviceFilter }` | Chama a próxima senha do setor (`serviceFilter` padrão: `ALL`). |
| `POST` | `/api/recall` | `{ code, desk }` | Rechama uma senha que está no histórico. |
| `POST` | `/api/reset` | — | Zera filas, contadores, histórico e intervalos entre chamadas. |
| `GET` | `/api/tts?text=...` | — | Retorna um MP3 com o texto falado em português (com cache em `data/audio_cache/`). |
| `GET` | `/api/info` | — | IP local, porta e URL de acesso pela rede. |

Valores aceitos:

- `service`: `Vara Criminal`, `Família`, `Execução Penal`
- `category`: `NORMAL`, `PRIORIDADE`, `IDOSO`
- `prefix`: `CRIM`, `FAM`, `PEN` (padrão `ATD`)

Exemplo:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H 'Content-Type: application/json' \
  -d '{"service":"Família","category":"PRIORIDADE","prefix":"FAM"}'
```

### WebSocket

Conexão em `ws://<host>:<porta>/`. Ao conectar, o servidor envia `{ type: "stateUpdate", data }` e repete essa mensagem a cada mudança de estado.

Mensagens aceitas (`{ type, payload }`):

| `type` | `payload` | Resposta |
|---|---|---|
| `GET_STATE` | — | `stateUpdate` |
| `NEW_TICKET` | `{ service, category, prefix }` | `ticketCreated` |
| `CALL_TICKET` | `{ desk, serviceFilter }` | `ticketCalled` ou `error` |
| `RECALL_TICKET` | `{ code, desk }` | `ticketRecalled` ou `error` |
| `RESET_SYSTEM` | — | `systemReset` |
| `ping` | — | `pong` |

O Socket.IO também está disponível em `/socket.io` e emite o evento `stateUpdate`.

## Estrutura do projeto

```
sistema-senhas/
├── src/                  # Servidor (Node.js)
│   ├── server.js         # Ponto de entrada: Express, arquivos estáticos e listen
│   ├── config.js         # Porta, caminhos e constantes (intervalo entre chamadas, tamanho do histórico)
│   ├── state.js          # Estado das filas e persistência em data/state.json
│   ├── queue.js          # Regras de negócio: emitir, chamar, rechamar e zerar
│   ├── routes.js         # Rotas REST em /api
│   ├── realtime.js       # WebSocket nativo e Socket.IO
│   ├── tts.js            # Síntese de voz com cache
│   └── network.js        # Descoberta do IP da rede local
├── public/               # Tudo o que o navegador recebe
│   ├── index.html        # Página inicial com links para as telas
│   ├── totem.html        # Emissão de senhas
│   ├── guiche.html       # Controle dos guichês
│   ├── painel.html       # Painel de TV com anúncio por voz
│   ├── cliente.html      # Acompanhamento pelo celular
│   ├── css/              # style.css (comum) + estilos de cada tela
│   ├── js/               # shared.js (comum) + script de cada tela
│   └── images/           # Logotipo da DPE-PA
└── data/                 # Gerado em execução (fora do Git)
    ├── state.json        # Estado salvo
    └── audio_cache/      # MP3s de TTS em cache
```

Só a pasta `public/` é servida pelo navegador. O código do servidor e os dados em `data/` não ficam acessíveis pela rede.

## Observações

- Para zerar o sistema no início do dia, use o botão no guichê ou `POST /api/reset`. Também dá para parar o servidor e apagar `data/state.json`.
- `data/audio_cache/` pode ser apagado a qualquer momento; os áudios são gerados de novo quando necessário.
- `data/` é gerado durante a execução e fica fora do Git (veja `.gitignore`).
- A API não tem autenticação. Use o sistema apenas em rede interna confiável.

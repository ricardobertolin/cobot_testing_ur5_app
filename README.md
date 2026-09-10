# cobot_testing_ur5_app

Pendant e digital twin do UR5 CB2 no navegador. É a versão web do
[`cobot_testing_app`](https://github.com/ricardobertolin/cobot_testing_app)
extraída para rodar sozinha: um processo Python serve as páginas, e o cliente
é qualquer navegador na mesma rede, incluindo o iPad da célula.

Robô do laboratório com controlador CB2 rodando PolyScope / URControl
1.8.25319. É a geração anterior ao CB3: não tem RTDE, e toda leitura de
estado sai da interface real-time.

## Abrir sem instalar nada

Em
[ricardobertolin.github.io/cobot_testing_ur5_app](https://ricardobertolin.github.io/cobot_testing_ur5_app/)
o primeiro botão abre o `pendant_dt` direto no navegador, sem Python, sem
download e sem digitar endereço nenhum. É o caminho do iPad: Safari,
Compartilhar → Adicionar à Tela de Início, e vira um app em tela cheia.

Nesse modo a cinemática roda no próprio navegador, no `web/local.js`, e as
malhas vêm de `web/malha/N.bin`, arquivos parados de 1,75 MB no total. A
página é a mesma: ela tenta o `/config.json` do servidor e, quando não há
Python do outro lado, cai para o motor local sozinha. O `?local=1` na URL
força esse caminho mesmo com o servidor no ar, que é como se testa.

O que esse modo **não** faz é robô. Navegador não abre socket cru, então nem
`--espelhar` nem `--comandar` existem ali: é simulação, e a pílula do canto
diz `SIMULAÇÃO` o tempo todo. Para ver ou mover o UR5 de verdade, é o
servidor Python abaixo.

### iPad velho: o robô vira silhueta

WebGL2 só chegou ao iPad no iPadOS 15, e Pointer Events no 13. Num iPad
anterior a isso — o de 2012, por exemplo — a tela abria e não desenhava o robô
nem obedecia ao dedo. Agora as duas coisas caem para o que existe desde sempre:

- **Sem WebGL2**, o robô é desenhado em Canvas 2D pelo `web/twin2d.js`. Cada
  elo vira um polígono: o fecho convexo de 56 pontos do próprio CAD,
  projetados com a mesma câmera. Sombra no chão, gradiente por peça e ordem do
  pintor fazem o resto. São 9 kB (`web/silhueta.json`) contra 1,75 MB de malha.
- **Sem Pointer Events**, as teclas de jog e a órbita da câmera usam Touch
  Events, com o mouse como terceira opção.

A silhueta é aproximada por construção: fecho convexo não tem buraco, então o
vão do cotovelo fecha e os furos do flange somem. A pose, o tamanho e a direção
da ferramenta continuam exatos, porque saem das mesmas transformações.

Se ainda assim a tela não abrir, `web/diagnostico.html` testa oito coisas e diz
qual falhou. Ele é escrito em JavaScript de 2010 de propósito — `var`,
`function`, `XMLHttpRequest` — porque um diagnóstico que não roda no aparelho
com defeito não diagnostica nada.

Duas cópias da cinemática é uma dívida conhecida, e está anotada no cabeçalho
do `local.js`: navegador não roda numpy. O que a mantém honesta é o formato
idêntico — o estado que sai do `local.js` tem os mesmos campos, nas mesmas
unidades, do que sai do `instantaneo()` do Python, e o
`preparar_web.py` regera os `.bin` do mesmo cache que o servidor serve.

## Rodar

Quem só quer usar, sem mexer em terminal: em
[ricardobertolin.github.io/cobot_testing_ur5_app](https://ricardobertolin.github.io/cobot_testing_ur5_app/)
baixe o `iniciar.bat` (Windows) ou o `iniciar.sh` (macOS e Linux) e dê dois
cliques. Ele acha o Python, baixa este repositório, resolve o numpy, sobe o
servidor e abre a tela sozinho. Na mão:

```
pip install numpy
python servidor_ur5.py
```

Ele imprime o endereço da máquina na rede. No iPad, no mesmo Wi-Fi:

```
http://<ip-do-pc>:8080/pendant_dt     a tela e o 3D na mesma página
http://<ip-do-pc>:8080/pendant        só a tela Move do PolyScope
http://<ip-do-pc>:8080/twin           só o robô do CAD em 3D
```

No iPad o `/pendant_dt` é o que vale, porque lá não dá para pôr duas janelas
lado a lado. Em tela larga fica controles à esquerda e 3D à direita, em
retrato empilha, com o 3D embaixo. As outras duas continuam existindo para
quem tem dois monitores, ou para deixar o twin numa TV e a tela num tablet.

No Safari, Compartilhar → Adicionar à Tela de Início, e abre em tela cheia
com ícone próprio.

## Os quatro modos

```
python servidor_ur5.py                       simulação, não abre socket nenhum
python servidor_ur5.py --robo 10.26.10.20    só acende a pílula de conexão
python servidor_ur5.py --espelhar 10.26.10.20   mostra a posição real, jog desligado
python servidor_ur5.py --comandar 10.26.10.20   MOVE O ROBÔ DE VERDADE
```

O `--robo` só consulta o dashboard a cada 2 s para acender a pílula. Não lê
posição e não comanda nada, e é o modo mais leve dos quatro: serve para
deixar uma tela de monitoramento aberta sem ocupar a 30003.

O `--espelhar` lê a interface real-time e mostra a posição real das juntas,
com o jog desabilitado. Nenhum byte sai para a 30002.

O servidor escuta em todas as interfaces. Se a rede não for isolada,
`--host 127.0.0.1` limita à própria máquina, e isso importa bem mais com
`--comandar` do que nos outros três modos.

### O `--comandar` é exceção consciente

A decisão registrada no projeto é que jog fica no teach pendant, que é onde
estão a parada de emergência em hardware e o dispositivo de habilitação de
três posições. O `--comandar` abre a mesma exceção que o `pendant_real.py` de
desktop abre, e reaproveita exatamente o código dele: `Canal`, `Controle` e o
leitor vêm de lá, sem uma segunda cópia da lógica de comando. Jog em dois
lugares com duas contas diferentes seria o jeito garantido de a tela e o robô
discordarem.

Nesse modo a página fica com uma tarja vermelha, as poses fixas somem, porque
salto instantâneo de juntas só existe em simulação, e no lugar delas aparecem
PARAR, INICIO e DEFINIR INICIO. O jog cartesiano fica só em X, Y e Z, que é o
que o `speedl` expõe. RX, RY e RZ aparecem como leitura, sem seta, em vez de
ganharem uma tecla que não faz nada.

O que sobra de proteção:

**Dois cães mortos em série.** A página renova o pedido de jog a cada 200 ms,
e passando meio segundo sem renovação o servidor solta o jog. E cada comando
que chega no robô é um `speedj`/`speedl` com prazo `t`, então o robô
desacelera sozinho se o servidor parar. Wi-Fi caído derruba o primeiro,
Python morto derruba o segundo, e nenhum dos dois deixa junta girando.

**Limite de junta e modo do robô** conferidos a cada tique, no `Controle`.

O que continua sem substituto é a parada de emergência física. Mantenha o
teach pendant ao alcance da mão, e prefira `--espelhar` quando o que se quer
é só olhar.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `servidor_ur5.py` | O servidor. HTTP, Server-Sent Events e as rotas de malha. É o que se roda. |
| `ur5_comum.py` | Biblioteca base: sockets do controlador, cinemática direta por DH, validação de alcance, blend e velocidade. |
| `modelo_ur5.py` | Cinemática por produto de exponenciais e as malhas do CAD. Roda sozinho como autoteste. |
| `pendant_ur5.py` | O pendant de desktop, de onde o servidor tira as constantes de jog, as poses guardadas e o `Espelho` do `--espelhar`. Importar não abre janela: a janela só nasce no `main()` dele. |
| `pendant_real.py` | O pendant que move o robô de verdade, por `speedj`/`speedl` com prazo. É de onde vem o `--comandar`. |
| `preparar_cad_step.py` | Regera o cache de malhas a partir de um STEP de montagem, articulando o braço até a pose canônica. Só é preciso se você quiser refazer as malhas. |
| `preparar_web.py` | Escreve o cache de malhas como `web/malha/N.bin`, que é o que o modo navegador consome. Rode de novo se o cache mudar. |
| `web/` | As páginas: `pendant.html`, `twin.html` e `pendant_dt.html`. Sem framework e sem CDN. |
| `web/local.js` | O servidor traduzido para dentro da página: cadeia, jacobiano, jog e config. Só é baixado quando não há Python do outro lado. |
| `web/twin2d.js` | O robô em Canvas 2D, para navegador sem WebGL2. Silhueta por fecho convexo, mesma câmera do 3D. Só é baixado quando falta WebGL2. |
| `web/diagnostico.html` | Oito checagens que dizem por que a tela não abriu. Escrito em JavaScript antigo, para rodar até no iPad que não roda o resto. |
| `web/malha/` | As malhas prontas para o modo navegador, 1,75 MB. Saem do `preparar_web.py` e vão versionadas: sem elas o GitHub Pages abre a tela sem robô. |
| `web/silhueta.json` | 56 pontos por elo, 9 kB, para o modo 2D. Mesmo gerador das malhas. |
| `malhas/` | O cache de malhas já gerado, uns 0,9 MB. Vai versionado aqui de propósito, para o repositório abrir e rodar sem o CAD original por perto. |

## Dependências

Só `numpy`. Todo o resto é biblioteca padrão: o HTTP é o `http.server`, o
estado desce por Server-Sent Events, que é uma resposta HTTP que não termina,
e o 3D é WebGL2 puro. Nada de FastAPI, nada de three.js, nada de CDN, por
duas razões: a página precisa abrir numa rede isolada de célula, sem
internet, e menos peça instalada é menos coisa para quebrar meses depois.

O preço é não ter WebSocket. Para este uso não faz falta: o fluxo pesado é só
de descida e o SSE resolve, e a subida são os toques de jog, que são eventos
esparsos e cabem num POST.

O `tkinter` precisa estar disponível, porque o `pendant_ur5.py` importa ele
no topo. Vem junto do Python no Windows e no macOS. Em Linux enxuto, sem
pacote de servidor gráfico, pode ser preciso instalar (`python3-tk`), mesmo
que nenhuma janela vá abrir.

O `vedo` e o `pillow` da versão de desktop não são usados aqui, e o VTK só
entra se você for regerar o cache de malhas.

## O jog é tecla presa, não clique

Se a página fechar, o Wi-Fi cair ou o dedo sair da tela sem o evento de
soltar chegar, a junta ficaria girando sozinha para sempre. Por isso a página
renova o pedido de jog a cada 200 ms e o servidor para sozinho se passar meio
segundo sem renovação. Em simulação ninguém se machuca, mas jog sem prazo de
validade é um hábito ruim de carregar para perto de robô, e com `--comandar`
esse prazo deixa de ser higiene e passa a ser a proteção.

## O indicador de conexão

Toda página traz uma pílula na barra de cima dizendo em que pé está o enlace
com o robô. O texto basta sozinho: a cor é reforço, não a informação.

| Pílula | Cor | O que houve |
|---|---|---|
| `SIMULAÇÃO` | cinza | nenhum robô envolvido, a pose sai da cinemática do Python |
| `CONECTADO` | verde | o robô responde e está em RUNNING |
| `COMANDANDO` | verde | idem, e esta tela está movendo ele |
| `ROBÔ NÃO PRONTO` | amarelo | a rede está boa, mas o robô não pode mover (sem potência, freios travados, protective stop) |
| `SEM POSIÇÃO` | amarelo | o dashboard responde e a 30003 não: cabo bom, stream morto |
| `SEM CONEXÃO` | vermelho | o robô não respondeu |
| `SEM SERVIDOR` | vermelho | a página perdeu o Python |

O detalhe completo, com a explicação do que fazer, fica no `title`, então
passe o mouse por cima.

A distinção entre amarelo e vermelho é o ponto todo: são dois problemas com
soluções diferentes, e adivinhar qual é custa tempo na célula. Vermelho é
cabo, IP ou firewall, amarelo é ir até o teach pendant.

Em `--espelhar` e `--comandar` o indicador liga sozinho.

## Ethernet

O CB2 não faz DHCP de forma confiável para este uso. Endereço fixo dos dois
lados, mesma sub-rede, cabo direto ou switch.

**No robô**, pelo teach pendant: `Setup Robot` → `Setup Network`. Escolha
`Static Address` e preencha:

```
IP address       10.26.10.20        (é o padrão do ur5_comum.py)
Subnet mask      255.255.255.0
Default gateway  0.0.0.0            (em rede isolada não precisa)
```

Aplique e confirme que a tela mostra `Network is connected`.

**No PC**, um endereço fixo na mesma faixa, qualquer um menos o do robô:

```
IP               10.26.10.10
Máscara          255.255.255.0
Gateway          em branco
```

Cabo direto funciona: as placas modernas fazem auto MDI-X, não precisa de
cabo cruzado.

**Confira**, nesta ordem, porque cada passo elimina uma causa:

```
ping 10.26.10.20
python -c "import ur5_comum as ur; print(ur.dashboard('robotmode'))"
python -c "import ur5_comum as ur; print(ur.ler_juntas())"
```

O `ping` responde com o controlador ligado mesmo sem potência nas juntas. O
`dashboard` responde texto e é o que diz se o robô pode mover. O `ler_juntas`
abre a 30003 e devolve seis valores em radianos.

Se o ping passa e as portas não, é firewall do Windows na conexão de saída do
Python, ou o robô ainda está inicializando.

### As portas do CB2

```
29999   dashboard server   estado e controle de programa, em texto
30001   primary client     estado + URScript, ~10 Hz
30002   secondary client   envio de URScript, ~10 Hz
30003   real-time          estado do robô, 125 Hz
```

Não existe 30004 (RTDE) aqui: RTDE entrou no CB3 a partir do 3.1. O pacote da
30003 no 1.8 tem 812 bytes, e é esse layout que o `ur5_comum.py` decodifica.

### Uma armadilha que custa tempo

Script enviado para a 30002 com o robô sem potência ou em protective stop é
aceito pelo socket e silenciosamente ignorado. Sem checar o estado antes, o
Python conclui "movimento ok" e nada aconteceu. É para isso que existe
`verificar_pronto()`, e o `--comandar` passa por ela antes de abrir qualquer
socket de comando.

## Se o 3D ficar em "carregando malhas do CAD..." para sempre

Quase sempre é **aba demais aberta no mesmo endereço**, e não o servidor.

O `/estado` é uma resposta HTTP que nunca termina, e o navegador só abre 6
conexões por endereço. Cada aba visível segura uma delas enquanto estiver na
tela, então a partir da sétima não sobra conexão nem para baixar a malha.
Feche as outras abas e recarregue. A página avisa isso na tela depois de
alguns segundos, em vez de ficar pendurada calada.

Abas em segundo plano não contam: elas fecham o fluxo de estado e devolvem a
conexão, reabrindo quando voltam para a frente. O limite prático é 6 abas
visíveis ao mesmo tempo, o que num notebook ou num iPad não acontece.
Dispositivos diferentes também não brigam entre si, porque o limite é por
navegador.

## O CAD

O cache em `malhas/` já vem pronto, então nada abaixo é necessário para rodar.

Para refazer a partir dos `.obj` por peça, que o modelo espera em
`~/Documentos/_FACULDADE/_GRADUAÇÃO/_TCC/TCC_LASVII_2/Robots/UR5/3D PARTS/ur5_parts`
ou no caminho que estiver na variável de ambiente `UR5_CAD`:

```
pip install vedo
python modelo_ur5.py --preparar
```

O original tem 573 MB, o que é inviável para carregar a cada abertura. O
`modelo_ur5.py` simplifica cada peça, junta por elo e grava em `malhas/`, que
fica com uns 3 MB antes de empacotar.

Se o que você tem é um **STEP de montagem** baixado de um portal de CAD, ele
vem numa pose qualquer e com as peças agrupadas por submontagem, e aí o
caminho é outro:

```
pip install cascadio trimesh scipy fast-simplification
python preparar_cad_step.py UR5.STEP
```

Ele acha os eixos de junta pelos anéis de contato entre elos vizinhos,
articula o braço até a pose que o modelo espera e grava o mesmo
`malhas/ur5_elo*.npz`. Duas armadilhas que o arquivo documenta e que custam
tempo: entre eixos paralelos não dá para ancorar pela perpendicular comum, e
soldar os vértices antes de decimar é o que impede a parede fina de colapsar.
Sem isso o braço perde 95% do volume e fica transparente na tela.

Para conferir que a cinemática está correta antes de confiar no desenho:

```
python modelo_ur5.py
```

Ele compara a cadeia usada pelo twin com a cinemática direta por DH do
`ur5_comum.py`, que veio de outra fonte. Em 200 poses aleatórias as duas
fecham com erro máximo de 5.6e-16 m em posição e 8.0e-14 rad em orientação,
que é ruído de ponto flutuante.

## Sobre a arquitetura

O navegador é cliente burro. Não tem cinemática nenhuma: o servidor manda as
sete transformações já calculadas e a página só multiplica matriz e desenha.
O arquivo do `/pendant_dt` é o mesmo que o servidor do FANUC serve, byte por
byte. Ela não sabe qual robô está do outro lado, pede `/config.json` e monta
o que vier. Quais teclas de jog existem também vem do servidor, e não de um
`if` na página: uma tecla que existe e não faz nada é pior que a ausência
dela, porque o operador aperta, o robô não anda, e a dúvida passa a ser se o
robô travou.

O servidor também publica a pose em UDP na `127.0.0.1:47100`, então o
`twin3d_ur5.py` de desktop, no repositório original, segue a tela do
navegador sem precisar saber que ela existe.

## Créditos

- **Ricardo Bertolin**
- **Diego Simões Barreto** — coautor do projeto e colaboração no laboratório

Os robôs, a documentação e os modelos de CAD são do laboratório. O
`interface_ipad.md`, no repositório original, registra as decisões de projeto
que levaram a esta arquitetura e o porquê de cada uma.

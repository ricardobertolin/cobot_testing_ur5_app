# Painel de célula: o pendant num Raspberry Pi

Receita para transformar um Raspberry Pi com tela de toque num painel que
liga, mostra o pendant em tela cheia e comanda o UR5 sem ninguém digitar
nada. Nenhum arquivo deste repositório precisa mudar: tudo o que está aqui
mora no Pi, ao lado da cópia do projeto.

Dois aparelhos já foram montados com esta receita e servem de referência:

| | pendant3 | pendant4 |
|---|---|---|
| placa | Pi 3 Model B, 1 GB | Pi 4 Model B, 3.7 GB |
| sistema | Raspberry Pi OS Lite 64-bit, trixie | Raspberry Pi OS desktop, bookworm |
| sessão | console com autologin mais `startx` | Wayland com labwc |
| twin 3D | silhueta 2D do `twin2d.js` | WebGL2 com as malhas do CAD |
| usuário | `pi` | `raspberry` |
| eth0 | 10.26.10.200/24 e 192.168.7.1/24 | 10.26.10.201/24 e 192.168.7.11/24 |

Os endereços de eth0 são diferentes de propósito. Se os dois forem plugados
na mesma célula, não há conflito de IP.

## O que esperar de cada placa

O Pi 4 roda o twin completo. O VideoCore VI faz GLES 3.1, então há WebGL2 e
o `pendant_dt.html` desenha as malhas do CAD.

O Pi 3 não. O VideoCore IV para em GLES 2.0, não há WebGL2, e a página cai
sozinha no `twin2d.js`, que desenha cada elo como o fecho convexo de 56
pontos. A pose e o tamanho continuam exatos, o que some são vãos e furos.

A legenda embaixo do 3D diz em qual dos dois você está:

```
Pi 3:  silhueta em 2D (este navegador nao tem WebGL2) · arrastar gira
Pi 4:  arrastar gira · dois dedos ou roda aproxima · duplo toque limpa o rastro
```

Se o objetivo é demonstração, vá de Pi 4. Se é operação, o Pi 3 basta,
porque quem opera olha os números e os botões, não o render.

## Hardware

Cartão microSD de 16 GB serve, com folga: o sistema mais o Chromium mais o
projeto dão uns 5 GB. Classe do cartão importa mais que tamanho, porque um
painel ligado direto escreve log o tempo todo e cartão barato morre disso.

Fonte de 5V com 2,5 A ou mais, e cabo curto e grosso. Subtensão no Pi
corrompe cartão, e o sintoma é indistinguível de defeito de software:
travamentos, reinícios, tela que não acende. Confira com `vcgencmd
get_throttled`, que tem que devolver `0x0`.

O painel WaveShare de 7" precisa de duas ligações: HDMI para a imagem e
micro-USB para o toque, que é USB HID. Se a plaquinha tiver duas portas
micro-USB, uma é `Power` e a outra `Touch`. Se a tela piscar ou reiniciar,
alimente ela por fora e deixe a USB do Pi só para o toque.

Duas armadilhas de hardware que já custaram tempo. O HDMI precisa estar
plugado antes de ligar a energia, porque a detecção acontece no boot. E mau
contato no cabo HDMI produz exatamente o mesmo sintoma de um cartão sem
sistema, que é tela preta e nenhuma pista.

## Gravar o cartão

Raspberry Pi Imager, sistema `Raspberry Pi OS Lite (64-bit)` dentro de
`Raspberry Pi OS (other)`. Lite, sem desktop, porque a área de trabalho come
RAM para desenhar algo que ninguém vai usar. Num Pi 3 de 1 GB isso é a
diferença entre o Chromium respirar ou não.

Nas personalizações, antes de gravar: hostname, usuário e senha, Wi-Fi com
país `BR`, e na aba de serviços o SSH com **autenticação por chave pública**
e a chave colada. Autenticação por senha não serve para automação, porque um
terminal não interativo não tem onde digitar a senha.

O Lite não tem desktop. No primeiro boot a tela mostra texto rolando e para
num login preto e branco. Isso é sucesso, não erro.

### Se o cartão já foi gravado e você não tem acesso

Windows só enxerga a partição de boot, que é FAT32. A raiz é ext4 e não dá
para escrever a chave nela de fora. O caminho é um script que roda no
próximo boot, com a raiz já montada:

1. Copie `cmdline.txt` para `cmdline.txt.bak` na partição de boot.
2. Escreva um `firstrun.sh` lá que instale a chave e ligue o `sshd`.
3. Acrescente ao fim da linha única do `cmdline.txt`:

```
systemd.run=/boot/firmware/firstrun.sh systemd.run_success_action=reboot systemd.run_failure_action=reboot systemd.unit=kernel-command-line.target
```

A primeira coisa que o `firstrun.sh` deve fazer é restaurar o `cmdline.txt`
do backup. Assim, se qualquer passo seguinte falhar, o próximo boot já é
normal e o pior caso é "não configurou", nunca "não liga".

Esse gancho não é confiável em toda instalação. Numa delas ele simplesmente
não rodou. O plano B que sempre funciona é rodar o mesmo script à mão no
terminal do próprio Pi, com o sistema de pé, onde a partição de boot está
garantidamente montada.

## Acesso

Gere uma chave dedicada, sem passphrase, porque um agente não interativo não
digita passphrase:

```
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_pi -N "" -C "painel-ur5"
```

No Windows, o OpenSSH recusa o `~/.ssh/config` se outro usuário tiver acesso
a ele. Se aparecer `Bad owner or permissions`:

```powershell
icacls $env:USERPROFILE\.ssh\config /inheritance:r
icacls $env:USERPROFILE\.ssh\config /grant:r "$($env:USERNAME):(F)"
```

Um atalho em `~/.ssh/config` evita repetir IP e usuário:

```
Host pendant3
    HostName 192.168.100.184
    User pi
    IdentityFile ~/.ssh/id_ed25519_pi
    StrictHostKeyChecking accept-new
    ServerAliveInterval 30
```

O `sudo` do Raspberry Pi OS às vezes vem pedindo senha, e aí todo comando
por SSH morre no timeout esperando um prompt que ninguém vê. Rode uma vez,
num terminal de verdade:

```
echo "$USER ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/010-nopasswd
sudo chmod 440 /etc/sudoers.d/010-nopasswd
```

## Dependências e cópia do projeto

```
sudo apt-get update
sudo apt-get install -y python3-numpy python3-tk git
```

O `python3-tk` não é opcional, e a razão não é óbvia. O `servidor_ur5.py`
importa `pendant_ur5`, que importa `tkinter` no topo do módulo. Nenhuma
janela nasce fora do `main()`, mas o import acontece de qualquer jeito e sem
o pacote o servidor morre antes de abrir a porta.

Copie o projeto para a casa do usuário. De outra máquina:

```
tar czf - --exclude=.git --exclude=__pycache__ . \
  | ssh pendant3 'mkdir -p ~/cobot_testing_ur5_app && tar xzf - -C ~/cobot_testing_ur5_app'
```

Confirme que o cache de malhas veio junto, senão o servidor tenta regerar a
partir do CAD no boot e falha se o CAD não estiver lá:

```
cd ~/cobot_testing_ur5_app && python3 -c "import modelo_ur5 as m; print(m.cache_existe())"
```

## O servidor como serviço

Três arquivos. Primeiro a configuração, em `/etc/default/pendant-ur5`:

```sh
# IP do controlador do UR5 (o mesmo UR_IP do ur5_comum.py).
ROBO_IP="10.26.10.20"

# Modo alvo, aplicado assim que o robo estiver alcancavel e em RUNNING:
#   comandar   A PAGINA MOVE O ROBO DE VERDADE
#   espelhar   posicao real das juntas, jog desligado
#   robo       so acende a pilula de conexao
#   simulacao  nunca tenta o robo
MODO="comandar"
```

Depois o lançador, em `~/iniciar-servidor.sh`. Ele existe por um motivo
específico e vale entender antes de copiar.

O `--comandar` exige o robô em RUNNING **no instante em que o servidor
sobe**: o `abrir_real()` chama `verificar_pronto()` e o `main()` faz
`return 1` se não estiver. Posto direto no systemd, isso significa que um Pi
ligado antes do robô fica com a porta 8080 fechada e a tela caída no motor
local do navegador, até alguém plugar o cabo. O lançador resolve subindo em
simulação, perguntando ao robô a cada cinco segundos, e trocando para o modo
alvo quando ele fica pronto.

```sh
#!/bin/bash
set -u
APP="$HOME/cobot_testing_ur5_app"
ROBO_IP="10.26.10.20"; MODO="simulacao"
[ -f /etc/default/pendant-ur5 ] && . /etc/default/pendant-ur5
cd "$APP" || exit 1

# Usa o verificar_pronto() do proprio projeto, para a resposta aqui ser
# exatamente a mesma que o abrir_real() vai obter logo em seguida.
robo_pronto() {
  ROBO_IP="$ROBO_IP" APP="$APP" python3 - <<'PY' 2>/dev/null
import os, sys
sys.path.insert(0, os.environ["APP"])
import ur5_comum as ur
pronto, _ = ur.verificar_pronto(os.environ["ROBO_IP"])
sys.exit(0 if pronto is True else 1)
PY
}

case "$MODO" in
  simulacao) exec python3 servidor_ur5.py ;;
  comandar)  ALVO="--comandar $ROBO_IP" ;;
  espelhar)  ALVO="--espelhar $ROBO_IP" ;;
  robo)      ALVO="--robo $ROBO_IP" ;;
  *) echo "MODO desconhecido: '$MODO'"; exec python3 servidor_ur5.py ;;
esac

while true; do
  if robo_pronto; then
    echo "robo $ROBO_IP pronto. Subindo em $ALVO."
    python3 servidor_ur5.py $ALVO
    echo "servidor saiu com $?. Reavaliando em 5s."; sleep 5; continue
  fi
  echo "robo $ROBO_IP nao esta pronto. Subindo em simulacao e vigiando."
  python3 servidor_ur5.py &
  SIM=$!
  while true; do
    sleep 5
    kill -0 "$SIM" 2>/dev/null || { echo "simulacao caiu."; break; }
    if robo_pronto; then
      echo "robo ficou pronto. Derrubando a simulacao."
      kill "$SIM" 2>/dev/null; wait "$SIM" 2>/dev/null; sleep 2; break
    fi
  done
done
```

E a unit, em `/etc/systemd/system/pendant-ur5.service`. Ajuste `User` e os
caminhos para o usuário da sua instalação:

```ini
[Unit]
Description=Pendant e digital twin do UR5 CB2
After=network.target
# Nao usa network-online.target de proposito: a tela tem que subir mesmo sem
# rede nenhuma. Quem espera o robo e o lancador, num laco.
StartLimitIntervalSec=0

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/cobot_testing_ur5_app
ExecStart=/home/pi/iniciar-servidor.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`StartLimitIntervalSec` vai em `[Unit]`, não em `[Service]`. No lugar errado
o systemd ignora com um aviso fácil de não ver. Confira com
`systemd-analyze verify`.

```
sudo systemctl daemon-reload && sudo systemctl enable --now pendant-ur5
```

## O quiosque

A configuração da tela fica em `/etc/default/pendant-kiosk`:

```sh
URL="http://localhost:8080/pendant_dt"
SCALE="0.75"
```

A escala não é capricho. Num painel de 800x480 o `pendant_dt` em tamanho
nativo empilha controles e 3D, e em 480 px de altura os dois ficam
espremidos com barra de rolagem. A 0,75 a área lógica vira 1066x640, passa
do limiar de 1000 px do `@media` e volta ao layout lado a lado. O preço é o
alvo de dedo cair de 44 para 33 px, uns 6,3 mm no painel de 7". Se o dedo
errar na prática, use `SCALE="1.0"` com `URL=".../pendant"`, que é a tela
Move inteira em tamanho cheio, sem o 3D.

A partir daqui o caminho depende da sessão gráfica.

### Variante A: sistema Lite, sem desktop (X11)

Autologin no console, e o login dispara o X:

```
sudo raspi-config nonint do_boot_behaviour B2
sudo apt-get install -y --no-install-recommends \
  xserver-xorg xinit x11-xserver-utils xserver-xorg-input-libinput \
  chromium unclutter matchbox-window-manager
```

`/etc/X11/Xwrapper.config`:

```
allowed_users=console
needs_root_rights=yes
```

`~/.bash_profile`, que sobe o quiosque só no console físico e deixa as
sessões de SSH em paz:

```sh
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor
fi
```

`~/.xinitrc`:

```sh
#!/bin/sh
. /etc/default/pendant-kiosk
MODO="simulacao"; ROBO_IP=""
[ -f /etc/default/pendant-ur5 ] && . /etc/default/pendant-ur5
ALVO="${URL}?alvo=${MODO}&robo=${ROBO_IP}"

xset s off; xset s noblank; xset -dpms
unclutter -idle 0.1 -root &
matchbox-window-manager -use_titlebar no -use_cursor no &
/home/pi/vigia-modo.sh &

exec chromium --kiosk "$ALVO" --force-device-scale-factor="$SCALE" \
  --lang=pt-BR --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --disable-restore-session-state \
  --no-first-run --password-store=basic --touch-events=enabled \
  --disable-pinch --overscroll-history-navigation=0 \
  --disable-features=Translate,TranslateUI
```

O `?alvo=` e `?robo=` na URL são como a extensão descobre o modo alvo sem
ler `/etc`. A página ignora parâmetros que não conhece, ela só olha o
`?local=1`.

### Variante B: sistema com desktop (Wayland, labwc)

Aqui não existe `.xinitrc`. O gatilho é o autostart do labwc.

Primeiro tire a área de trabalho do caminho. O labwc executa os `autostart`
de **todos** os diretórios XDG, não só o primeiro, então criar um do usuário
não substitui o do sistema. Edite `/etc/xdg/labwc/autostart`, guardando o
original ao lado, e deixe só:

```sh
/usr/bin/kanshi &
/usr/bin/lxsession-xdg-autostart
```

As linhas removidas são o `pcmanfm --desktop` e o `wf-panel-pi`, que são o
papel de parede com ícones e a barra de tarefas.

`~/.config/labwc/autostart`:

```sh
/home/raspberry/quiosque.sh &
/home/raspberry/vigia-modo.sh &
```

`~/quiosque.sh`, com o Chromium num laço de respawn:

```sh
#!/bin/bash
set -u
. /etc/default/pendant-kiosk
MODO="simulacao"; ROBO_IP=""
[ -f /etc/default/pendant-ur5 ] && . /etc/default/pendant-ur5
ALVO="${URL}?alvo=${MODO}&robo=${ROBO_IP}"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DISPLAY="${DISPLAY:-:0}"

# O autostart dispara junto com o compositor. Subir o Chromium antes de a
# saida de video estar anunciada, ou antes de o Xwayland aceitar conexao,
# faz ele escolher um tamanho padrao e nao entrar em tela cheia.
for _ in $(seq 1 30); do wlr-randr 2>/dev/null | grep -q "Enabled: yes" && break; sleep 1; done
for _ in $(seq 1 30); do xset -q >/dev/null 2>&1 && break; sleep 1; done
sleep 2

while true; do
  PERFIL="$HOME/.config/chromium/Default/Preferences"
  [ -f "$PERFIL" ] && sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/; s/"exited_cleanly":false/"exited_cleanly":true/' "$PERFIL"
  chromium --ozone-platform=x11 --kiosk "$ALVO" \
    --force-device-scale-factor="$SCALE" --lang=pt-BR --noerrdialogs \
    --disable-infobars --disable-session-crashed-bubble \
    --disable-restore-session-state --no-first-run --password-store=basic \
    --touch-events=enabled --disable-pinch --overscroll-history-navigation=0 \
    --disable-features=Translate,TranslateUI
  sleep 2
done
```

Repare no `--ozone-platform=x11`. Não é descuido. Com Wayland nativo o
`--force-device-scale-factor` encolhe a **geometria da janela**, não só o
conteúdo: a 0,75 a janela nasce com 600x360 físicos num painel de 800x480,
com o resto preto em volta. Sob XWayland a escala afeta só o conteúdo e o
`--kiosk` ocupa a tela toda.

Se o toque errar o alvo, confira `~/.config/labwc/rc.xml`. O `mapToOutput`
tem que casar com o nome que o `wlr-randr` reporta. Numa instalação ele veio
apontando para `HDMI-A-2` numa placa cuja saída é `HDMI-A-1`.

## O vigia de modo

O Chromium carrega a página uma vez, no boot. Se naquele instante o servidor
ainda estava em simulação esperando o robô, a tela fica em simulação para
sempre, porque ninguém manda ela recarregar. O vigia fecha esse buraco.

`~/vigia-modo.sh`:

```sh
#!/bin/bash
ANTERIOR=""
ler_modo() {
  curl -s -m 3 http://localhost:8080/config.json 2>/dev/null | python3 -c '
import sys, json
try: d = json.load(sys.stdin)
except Exception: print("fora"); raise SystemExit
print("comanda" if d.get("comanda") else ("espelho" if d.get("espelho") else "simulacao"))
' 2>/dev/null
}
while true; do
  ATUAL=$(ler_modo); [ -z "$ATUAL" ] && ATUAL="fora"
  if [ -n "$ANTERIOR" ] && [ "$ATUAL" != "$ANTERIOR" ]; then
    logger -t vigia-modo "modo mudou de $ANTERIOR para $ATUAL, recarregando"
    # X11:     xdotool key --clearmodifiers F5
    # Wayland: pkill -x chromium   (o laco do quiosque.sh traz de volta)
    pkill -x chromium
    sleep 8
  fi
  ANTERIOR="$ATUAL"; sleep 5
done
```

Em X11 dá para mandar um F5 com `xdotool`. Em Wayland não: um processo não
injeta tecla na janela de outro. Por isso a variante B mata o Chromium e
deixa o laço do `quiosque.sh` trazer ele de volta, já lendo o
`/config.json` novo.

## A extensão do Chromium

Quatro ajustes de interface que valem só no painel e não no repositório.
Ponha os três arquivos em `/usr/share/chromium/extensions/pendant-kiosk/`.

O diretório importa. O `/etc/chromium.d/extensions` do Raspberry Pi OS faz:

```sh
export CHROMIUM_FLAGS="$CHROMIUM_FLAGS --load-extension=`ls -dm /usr/share/chromium/extensions/* | tr -d '\n'`"
```

Com a pasta vazia isso gera um `--load-extension=` **vazio**. Somado a um
`--load-extension` próprio na linha de comando, ficam duas ocorrências da
mesma flag e o Chromium usa uma só, de forma não confiável: carrega numa
vez, não carrega na seguinte, sem nada no log. Pondo a extensão onde esse
script procura, existe uma flag só e o mecanismo é o da própria
distribuição. Não passe `--load-extension` no seu comando.

`manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Pendant kiosk",
  "version": "1.1",
  "content_scripts": [{
    "matches": ["http://localhost/*", "http://127.0.0.1/*"],
    "css": ["fix.css"],
    "js": ["armado.js"],
    "run_at": "document_end"
  }]
}
```

`fix.css`:

```css
/* 1. Trava o layout em duas colunas.

   Sem isto, apertar uma seta de jog trocava o painel de duas colunas para
   uma no meio do movimento, e o botao saia de baixo do dedo. A cadeia: o
   status passa de "parado" para "em movimento", o header (flex-wrap:wrap)
   quebra em duas linhas, a linha extra rouba altura do main, os controles
   deixam de caber, nasce barra de rolagem, a barra come ~15px de largura,
   e o #controles com repeat(auto-fit, minmax(18.5rem,1fr)) numa coluna de
   38rem tem folga de so 4,8px (2 x 296 + 11 = 603 contra 608). Perde os
   15px e cai para uma coluna, que e mais alta, que mantem a barra, que
   trava o estado.

   Mexer na escala do Chromium nao resolveria: rem nao muda com a escala,
   a coluna continuaria com 608px. */
header,
header .direita { flex-wrap: nowrap !important; }
header .estado { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
#controles { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }

/* Paga a conta da coluna forcada: com 2 x 1fr numa largura reduzida pela
   barra, a linha ficaria com ~291px contra os 296px que precisa, e a
   segunda tecla sairia pela direita. As teclas ficam intactas: o alvo de
   dedo de 44px nao se negocia. */
.rotulo { width: 3.5rem !important; }
.valor  { min-width: 3.4rem !important; }
header a, header button.link { white-space: nowrap; }

/* 2. Tarja de ARMADO. Ambar de proposito: nao pode ser confundida com o
      #aviso vermelho do app, que significa "esta movendo o robo AGORA".
      Esta significa "vai mover assim que o robo ligar". */
#kiosk-armado {
  display: none; background: #b35c00; color: #fff; font-weight: 700;
  text-align: center; padding: .3rem .6rem; font-size: .82rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none;
}

/* 3. O botao "tela cheia" nao tem funcao num quiosque que ja nasce em tela
      cheia, e no modo de comando ele e empurrado para fora da tela. */
#botao-cheia { display: none !important; }
```

`armado.js` tem duas partes. A primeira desenha a tarja de armado, lendo o
modo alvo do `?alvo=` da URL e comparando com o que o `/config.json` está
servindo. Enquanto forem diferentes, a tarja fica. A segunda apaga a frase
de preenchimento do rodapé:

```js
// O #mensagem NAO e decoracao. Ele carrega avisos que importam:
//   "singularidade proxima (sigma ...)"
//   "sem conexao com o servidor, reconectando..."
//   "robo real em <ip> - a parada de emergencia continua sendo a fisica"
// Esconder o rodape inteiro apagaria todos esses junto. Por isso o filtro e
// por TEXTO, nao por elemento: some so a frase que o servidor_ur5.py usa
// quando nao ha nada a dizer.
(function () {
  const PREENCHIMENTO = /^cliente burro/i;
  const achar = () => document.getElementById("mensagem");
  function limpar() {
    const el = achar();
    if (el && PREENCHIMENTO.test(el.textContent.trim())) el.textContent = "";
  }
  function observar() {
    const el = achar();
    if (!el) { setTimeout(observar, 500); return; }
    limpar();
    // Escrever "" nao re-dispara o filtro: string vazia nao casa com o padrao.
    new MutationObserver(limpar).observe(el, {
      childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", observar);
  else observar();
})();
```

## A rede do robô

O Pi tem uma porta Ethernet e ela vai para o controlador. O Wi-Fi fica para
o acesso remoto. Os dois endereços fixos na mesma interface servem a
propósitos diferentes: um fala com o robô, o outro é uma porta de serviço
que não depende de saber a faixa do robô.

```
sudo nmcli con modify netplan-eth0 connection.autoconnect no
sudo nmcli con add type ethernet ifname eth0 con-name robo \
  ipv4.method manual \
  ipv4.addresses "10.26.10.200/24,192.168.7.1/24" \
  ipv4.never-default yes \
  ipv6.method disabled \
  connection.autoconnect yes \
  connection.autoconnect-priority 100
```

O `ipv4.never-default yes` é a linha que não pode faltar. Sem ela o eth0
pode assumir a rota padrão e derrubar o Wi-Fi, que é justamente por onde
chega o SSH que você usaria para consertar.

Desligar o autoconnect do perfil DHCP existente evita que ele brigue com o
fixo. Numa rede sem servidor DHCP ele só atrasa o boot e termina num
169.254 inútil.

Com isso, plugar o cabo é a única ação: o perfil sobe sozinho, a rota
conectada de `/24` é mais específica que a rota padrão, e o tráfego para o
robô sai pelo eth0.

Para chegar no Pi por cabo, sem Wi-Fi, ponha o notebook em `192.168.7.2/24`
e use `ssh pi@192.168.7.1`. No Windows:

```powershell
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.7.2 -PrefixLength 24
Remove-NetIPAddress -IPAddress 192.168.7.2 -Confirm:$false   # desfazer
```

Com um switch burro entre robô, Pi e notebook dá para usar `10.26.10.100/24`
e manter o robô conectado enquanto trabalha. É o arranjo que vale montar se
o painel vai ficar na célula.

## Testar sem robô

Vale montar um CB2 de mentira antes de estar no laboratório. Ele levanta as
três portas que o projeto usa e obedece ao `speedj`, então o jog da tela move
as juntas de verdade:

```
29999  dashboard    responde "Robotmode: 0" ao comando robotmode
30002  secundaria   recebe URScript e integra speedj/speedl/stopj
30003  real-time    transmite pacotes de 812 bytes a 125 Hz
```

Dê ao próprio Pi o endereço do robô, num alias de loopback, para o caminho
testado ser o caminho real:

```
sudo ip addr add 10.26.10.20/32 dev lo
python3 -u ur5_falso.py
```

O `-u` importa, senão o log fica em buffer e parece que nada aconteceu.

Em até dez segundos o lançador troca para comando e a tela vira sozinha.
Ao terminar, e isto não é opcional:

```
pkill -f "[u]r5_falso"
sudo ip addr del 10.26.10.20/32 dev lo
```

Deixar esse alias faria o Pi conversar consigo mesmo achando que é o robô, e
no laboratório o UR5 real nunca seria alcançado. O alias não sobrevive a um
reboot, mas não conte com isso.

O `pkill -f ur5_falso` casa com a própria linha de comando se você rodar por
SSH, e mata a sua sessão junto. Os colchetes em `[u]r5_falso` evitam isso.

## Segurança

O `--comandar` é exceção consciente, e está registrado no README deste
projeto: jog fica no teach pendant, que é onde estão a parada de emergência
em hardware e o dispositivo de habilitação de três posições. Um painel
parafusado na célula não tem nenhum dos dois, e um botão numa tela
capacitiva não tem homem-morto.

Se o painel subir com `MODO="comandar"`, ele entra em modo de comando
**sozinho**, sem confirmação, assim que o robô entrar em RUNNING. É o que
plug-and-play significa aqui. A tarja âmbar de ARMADO existe justamente para
que ninguém olhe para aquela tela durante a espera e pense que é um
simulador.

Se a intenção é só acompanhar, `MODO="espelhar"` lê a interface real-time e
mostra a posição real com o jog desligado, e nenhum byte sai para a 30002.

## Diagnóstico rápido

```
systemctl status pendant-ur5        estado do servidor
journalctl -u pendant-ur5 -f        log ao vivo, mostra a troca de modo
vcgencmd get_throttled              0x0 = fonte OK, outro valor = subtensao
ip -br addr                         eth0 e wlan0 de relance
ip route get 10.26.10.20            confere se o trafego sai pelo eth0
wlr-randr                           saidas de video (Wayland)
xrandr                              saidas de video (X11)
grim /tmp/t.png                     captura de tela (Wayland)
scrot -o /tmp/t.png                 captura de tela (X11)
```

O que a tela diz sobre o estado:

```
tarja ambar  + pilula SIMULACAO      armado, esperando o robo
tarja vermelha + pilula COMANDANDO   esta movendo o robo
tarja vermelha + pilula SEM CONEXAO  conectou e perdeu (cabo, e-stop, potencia)
```

A terceira é útil: se ela aparecer, o problema é físico, não de software.

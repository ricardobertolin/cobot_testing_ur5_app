"use strict";
/*
  O servidor_ur5.py portado para dentro da pagina, para o modo sem Python.

  O pendant_dt.html e cliente burro de proposito: ele pede /config.json,
  escuta /estado e desenha as sete transformacoes que o Python manda pronta.
  Isso continua valendo quando ha servidor. So que no iPad de quem abriu o
  GitHub Pages nao ha servidor nenhum, e a escolha e entre a tela travada na
  primeira requisicao ou a mesma conta rodando aqui.

  Entao aqui esta a mesma conta. Este arquivo e a traducao de tres pedacos
  do Python, e nada alem deles:

      modelo_ur5.py    a cadeia por exponenciais, o jacobiano e a pose
      pendant_ur5.py   aplicar_jog, as poses guardadas, os limites
      servidor_ur5.py  configuracao() e instantaneo(), o que desce por SSE

  DUAS COPIAS DA CINEMATICA E UM RISCO CONHECIDO

  O projeto inteiro foi montado para nao ter isso: o pendant de desktop e o
  servidor compartilham aplicar_jog justamente para a tela e o twin nao
  discordarem. Aqui a copia e inevitavel - navegador nao roda numpy - e o
  que sobra e deixar a divida anotada e o formato identico. O `estado` que
  sai daqui tem os mesmos campos, nas mesmas unidades, do que sai do
  instantaneo() do Python; a pagina nao sabe qual dos dois esta falando.

  O QUE ESTE MODO NAO FAZ

  Robo real. Nem --espelhar nem --comandar existem sem socket, e navegador
  nao abre socket cru. Este modo e simulacao e diz isso na pilula. Para ver
  o UR5 de verdade continua sendo preciso o Python na mesma rede.
*/

(function(){

// ============================================================
// MODELO: modelo_ur5.py
// ============================================================

// Matriz 3x3 em ordem de LINHA, num vetor de 9. E o mesmo formato que o
// servidor manda em `corpos`, entao o paraModelo() da pagina nao muda.
const EIXOS = [
  [0, 0, 1], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, 0, 1], [0, -1, 0],
];

const PONTOS = [
  [0, 0, 0],
  [0, -0.13585, 0.089159],
  [0, -0.01615, 0.514159],
  [0, -0.01615, 0.906409],
  [0, -0.10915, 0.906409],
  [0, -0.10915, 1.001059],
];

const FLANGE = [0, -0.19145, 1.001059];
const FLANGE_R = [-1, 0, 0,  0, 0, -1,  0, -1, 0];
const OFFSET_CAD = [0, Math.PI / 2, 0, Math.PI / 2, 0, 0];
const LIMITE_JUNTA = 2 * Math.PI;

const IDENT3 = [1, 0, 0,  0, 1, 0,  0, 0, 1];

function mul3(a, b){
  const c = new Array(9);
  for(let i = 0; i < 3; i++){
    for(let j = 0; j < 3; j++){
      c[i*3+j] = a[i*3]*b[j] + a[i*3+1]*b[3+j] + a[i*3+2]*b[6+j];
    }
  }
  return c;
}

const aplicar3 = (m, v) => [
  m[0]*v[0] + m[1]*v[1] + m[2]*v[2],
  m[3]*v[0] + m[4]*v[1] + m[5]*v[2],
  m[6]*v[0] + m[7]*v[1] + m[8]*v[2],
];

const cruzar = (a, b) => [a[1]*b[2] - a[2]*b[1],
                          a[2]*b[0] - a[0]*b[2],
                          a[0]*b[1] - a[1]*b[0]];

// Rodrigues, com `eixo` unitario.
function rotacao(eixo, angulo){
  const [x, y, z] = eixo;
  const s = Math.sin(angulo), c = Math.cos(angulo), u = 1 - c;
  return [
    c + x*x*u,     x*y*u - z*s,   x*z*u + y*s,
    y*x*u + z*s,   c + y*y*u,     y*z*u - x*s,
    z*x*u - y*s,   z*y*u + x*s,   c + z*z*u,
  ];
}

// Os 7 corpos (base + 6 elos). O corpo 0 e a base fixa, entao sai
// identidade; o corpo j acumula as juntas 1..j.
function transformadas(q){
  const corpos = [{R: IDENT3.slice(), t: [0, 0, 0]}];
  let R = IDENT3.slice(), t = [0, 0, 0];

  for(let i = 0; i < 6; i++){
    const Ri = rotacao(EIXOS[i], q[i] + OFFSET_CAD[i]);
    // A junta gira em torno de uma reta que passa por PONTOS[i], nao pela
    // origem: a translacao compensa o afastamento do eixo.
    const giro = aplicar3(Ri, PONTOS[i]);
    const ti = [PONTOS[i][0] - giro[0], PONTOS[i][1] - giro[1],
                PONTOS[i][2] - giro[2]];
    const deslocado = aplicar3(R, ti);
    t = [t[0] + deslocado[0], t[1] + deslocado[1], t[2] + deslocado[2]];
    R = mul3(R, Ri);
    corpos.push({R: R.slice(), t: t.slice()});
  }
  return corpos;
}

function pontaDe(corpo){
  const p = aplicar3(corpo.R, FLANGE);
  return [p[0] + corpo.t[0], p[1] + corpo.t[1], p[2] + corpo.t[2]];
}

function poseFlange(q){
  const c = transformadas(q)[6];
  return pontaDe(c).concat(vetorRotacao(mul3(c.R, FLANGE_R)));
}

// Matriz de rotacao para vetor de rotacao, o formato de pose do UR.
function vetorRotacao(r){
  const sx = r[7] - r[5], sy = r[2] - r[6], sz = r[3] - r[1];
  const seno = 0.5 * Math.sqrt(sx*sx + sy*sy + sz*sz);
  const cosseno = (r[0] + r[4] + r[8] - 1) / 2;
  const angulo = Math.atan2(seno, cosseno);

  if(angulo < 1e-9) return [0, 0, 0];

  if(Math.PI - angulo > 1e-6){
    const fator = angulo / (2 * seno);
    return [fator * sx, fator * sy, fator * sz];
  }

  const eixo = [0, 1, 2].map(i => Math.sqrt(Math.max(0, (r[i*4] + 1) / 2)));
  const maior = eixo.indexOf(Math.max(...eixo));
  for(let j = 0; j < 3; j++){
    if(j !== maior) eixo[j] = (r[maior*3+j] + r[j*3+maior]) / (4 * eixo[maior]);
  }
  return eixo.map(c => c * angulo);
}

// Jacobiano geometrico 6x6 do flange, no frame da base. Sai de graca da
// formulacao por exponenciais: a coluna da junta i e o proprio eixo dela na
// pose atual. Linhas 0..2 linear, 3..5 angular.
function jacobiano(q){
  const corpos = transformadas(q);
  const ponta = pontaDe(corpos[6]);
  const J = Array.from({length: 6}, () => new Array(6).fill(0));

  for(let i = 0; i < 6; i++){
    const {R, t} = corpos[i];                 // corpo anterior a junta i
    const eixo = aplicar3(R, EIXOS[i]);
    const sobre = aplicar3(R, PONTOS[i]);
    const braco = [ponta[0] - sobre[0] - t[0],
                   ponta[1] - sobre[1] - t[1],
                   ponta[2] - sobre[2] - t[2]];
    const v = cruzar(eixo, braco);
    for(let k = 0; k < 3; k++){
      J[k][i] = v[k];
      J[k+3][i] = eixo[k];
    }
  }
  return J;
}

// Eliminacao de Gauss com pivotamento parcial, 6x6. Substitui o
// numpy.linalg.solve do passo_cartesiano.
function resolver(A, b){
  const n = b.length;
  const M = A.map((linha, i) => linha.concat([b[i]]));

  for(let c = 0; c < n; c++){
    let melhor = c;
    for(let l = c + 1; l < n; l++){
      if(Math.abs(M[l][c]) > Math.abs(M[melhor][c])) melhor = l;
    }
    [M[c], M[melhor]] = [M[melhor], M[c]];
    // O amortecimento do passo_cartesiano ja garante pivo nao nulo, mas se
    // um dia garantir de menos e melhor devolver zero que NaN: pose parada
    // e um defeito visivel, pose NaN some com o robo da tela.
    if(Math.abs(M[c][c]) < 1e-15) return new Array(n).fill(0);
    for(let l = c + 1; l < n; l++){
      const f = M[l][c] / M[c][c];
      for(let k = c; k <= n; k++) M[l][k] -= f * M[c][k];
    }
  }

  const x = new Array(n).fill(0);
  for(let l = n - 1; l >= 0; l--){
    let soma = M[l][n];
    for(let k = l + 1; k < n; k++) soma -= M[l][k] * x[k];
    x[l] = soma / M[l][l];
  }
  return x;
}

const normal = (J, amortecimento) => {
  const N = Array.from({length: 6}, () => new Array(6).fill(0));
  for(let i = 0; i < 6; i++){
    for(let j = 0; j < 6; j++){
      let s = 0;
      for(let k = 0; k < 6; k++) s += J[i][k] * J[j][k];
      N[i][j] = s + (i === j ? amortecimento * amortecimento : 0);
    }
  }
  return N;
};

// Um passo de jog cartesiano por minimos quadrados amortecidos. Perto de
// singularidade o movimento perde precisao na direcao ruim em vez de mandar
// a junta para o infinito, que e o mesmo motivo pelo qual o controlador do
// robo reclama em vez de obedecer.
function passoCartesiano(q, linear, angular, dt, amortecimento){
  const J = jacobiano(q);
  const alvo = linear.concat(angular);
  const x = resolver(normal(J, amortecimento === undefined ? 0.02 : amortecimento),
                     alvo);
  return q.map((v, i) => {
    let dq = 0;
    for(let k = 0; k < 6; k++) dq += J[k][i] * x[k];
    return v + dq * dt;
  });
}

// Menor valor singular do jacobiano, que e o que a barra de baixo usa para
// avisar de singularidade. Sem SVD: sigma_min = sqrt(menor autovalor de
// J*Jt), e J*Jt e simetrico, entao Jacobi ciclico resolve em algumas
// varreduras. Isto roda 30 vezes por segundo e some no ruido: sao seis
// linhas de matriz.
function menorSigma(J){
  const A = normal(J, 0);
  for(let varredura = 0; varredura < 12; varredura++){
    let fora = 0;
    for(let p = 0; p < 5; p++){
      for(let q = p + 1; q < 6; q++) fora += A[p][q] * A[p][q];
    }
    if(fora < 1e-22) break;

    for(let p = 0; p < 5; p++){
      for(let q = p + 1; q < 6; q++){
        if(Math.abs(A[p][q]) < 1e-14) continue;
        const theta = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
        const c = Math.cos(theta), s = Math.sin(theta);
        for(let k = 0; k < 6; k++){
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for(let k = 0; k < 6; k++){
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
    }
  }

  let menor = Infinity;
  for(let i = 0; i < 6; i++) menor = Math.min(menor, A[i][i]);
  return Math.sqrt(Math.max(0, menor));
}

// ============================================================
// JOG: pendant_ur5.py
// ============================================================

const VELOCIDADE_JOG_JUNTA = 45 * Math.PI / 180;   // rad/s a 100%
const VELOCIDADE_JOG_LINEAR = 0.150;               // m/s
const VELOCIDADE_JOG_ANGULAR = 0.5;                // rad/s
const LIMIAR_SINGULARIDADE = 0.02;

const NOMES = ["Base", "Ombro", "Cotovelo", "Punho 1", "Punho 2", "Punho 3"];

const POSES = {
  "Zero": [0, 0, 0, 0, 0, 0],
  "Vertical": [0, -90, 0, -90, 0, 0],
  "Trabalho": [0, -60, 90, -120, -90, 0],
};

// A tela nasce numa pose de trabalho, e nao na vertical: la o cotovelo
// esticado e o punho alinhado zeram tres valores singulares de uma vez, o
// jog cartesiano legitimamente nao anda, e quem abre a tela conclui que o
// programa quebrou.
const POSE_INICIAL = POSES["Trabalho"].map(v => v * Math.PI / 180);

// Um passo de jog. Devolve [nova_pose, aviso], com aviso null quando deu
// certo e a pose inalterada quando nao deu.
//   eixo    0..5 juntas, 6..11 as direcoes cartesianas X Y Z RX RY RZ
//   fracao  0..1, a velocidade da tela
//   recurso "Base" ou "Tool", so vale para o cartesiano
function aplicarJog(q, eixo, sinal, fracao, recurso, dt){
  let novo;

  if(eixo < 6){
    novo = q.slice();
    novo[eixo] += sinal * VELOCIDADE_JOG_JUNTA * fracao * dt;
  }else{
    const direcao = eixo - 6;
    let linear = [0, 0, 0], angular = [0, 0, 0];
    if(direcao < 3) linear[direcao] = sinal * VELOCIDADE_JOG_LINEAR * fracao;
    else angular[direcao - 3] = sinal * VELOCIDADE_JOG_ANGULAR * fracao;

    if(recurso === "Tool"){
      // As direcoes vem no frame da ferramenta e precisam ir para a base,
      // que e onde o jacobiano trabalha.
      const R = mul3(transformadas(q)[6].R, FLANGE_R);
      linear = aplicar3(R, linear);
      angular = aplicar3(R, angular);
    }
    novo = passoCartesiano(q, linear, angular, dt);
  }

  const estouro = novo.findIndex(v => Math.abs(v) > LIMITE_JUNTA);
  if(estouro >= 0){
    return [q.slice(), `J${estouro + 1} chegou em `
      + `${(novo[estouro] * 180 / Math.PI).toFixed(0)} graus, `
      + `o limite e +/- 360`];
  }
  return [novo, null];
}

// ============================================================
// CONFIG E ESTADO: servidor_ur5.py
// ============================================================

const ELOS = [
  ["base",      [0.28, 0.29, 0.31]],
  ["ombro",     [0.82, 0.83, 0.85]],
  ["braco",     [0.88, 0.89, 0.90]],
  ["antebraco", [0.85, 0.86, 0.88]],
  ["punho1",    [0.80, 0.81, 0.83]],
  ["punho2",    [0.80, 0.81, 0.83]],
  ["punho3",    [0.20, 0.21, 0.23]],
];

const CREDITOS = {
  projeto: "cobot_testing_app",
  pessoas: [
    "Ricardo Bertolin",
    "Diego Simões Barreto — coautor do projeto e colaboração no laboratório",
  ],
};

function configuracao(){
  return {
    robo: "UR5 CB2",
    controlador: "PolyScope 1.8.25319",
    jog_modo: "duplo",
    tema: "polyscope",
    abas: ["Program", "Installation", "Move", "I/O", "Log"],
    aba_ativa: "Move",
    leds: [],
    juntas: NOMES,
    unidade_junta: "deg",
    cartesiano: [
      {n: "X", u: "mm", d: 2}, {n: "Y", u: "mm", d: 2},
      {n: "Z", u: "mm", d: 2}, {n: "RX", u: "rad", d: 4},
      {n: "RY", u: "rad", d: 4}, {n: "RZ", u: "rad", d: 4},
    ],
    titulo_juntas: "Joint Position",
    titulo_cartesiano: "Robot",
    coordenadas: {rotulo: "Feature", valores: ["Base", "Tool"]},
    velocidade: {tipo: "slider", rotulo: "Speed", min: 1, max: 100, valor: 30},
    poses: Object.keys(POSES),
    jog_eixos: [0,1,2,3,4,5,6,7,8,9,10,11],
    acoes: [],
    aviso: "",
    comanda: false,
    espelho: false,
    // A pagina usa isto para saber que nao ha /pendant nem /twin do outro
    // lado, e para dizer na barra de baixo onde a conta esta rodando.
    local: true,
    elos: ELOS.map(([nome, cor]) => ({nome, cor})),
    camera: {raio: 2.2, alvo: [0, 0, 0.5], azimute: -130, elevacao: 22},
    grade: {tamanho: 2.0, divisoes: 20},
    escala_eixos: 0.15,
    creditos: CREDITOS,
  };
}

const PERIODO = 1 / 30;     // s entre passos da simulacao e quadros
const PRAZO_JOG = 0.5;      // s sem renovacao e o jog para sozinho

const agora = () => performance.now() / 1000;

// O mesmo contrato do servidor, visto pela pagina: um config, um fluxo de
// estado que se abre e se fecha, e um canal de subida para os comandos.
function criarLocal(){
  const est = {
    q: POSE_INICIAL.slice(),
    jog: null,
    jogAte: 0,
    velocidade: 30,
    recurso: "Base",
    mensagem: "",
    mensagemAte: 0,
  };

  let relogio = null, ouvinte = null, ultimo = agora();

  const avisar = (texto, segundos) => {
    est.mensagem = texto;
    est.mensagemAte = agora() + (segundos || 4);
  };

  function comandar(pedido){
    const acao = pedido.acao;
    if(acao === "jog"){
      est.jog = [Number(pedido.eixo), Number(pedido.sinal)];
      est.jogAte = agora() + PRAZO_JOG;
    }else if(acao === "parar"){
      est.jog = null;
    }else if(acao === "pose"){
      if(pedido.nome in POSES){
        est.q = POSES[pedido.nome].map(v => v * Math.PI / 180);
        est.jog = null;
        avisar("pose " + pedido.nome);
      }
    }else if(acao === "velocidade"){
      est.velocidade = Math.max(1, Math.min(100, Number(pedido.valor)));
    }else if(acao === "recurso"){
      if(pedido.valor === "Base" || pedido.valor === "Tool"){
        est.recurso = pedido.valor;
        est.jog = null;
      }
    }
    return Promise.resolve();
  }

  function passo(dt){
    if(est.jog === null) return;

    // O mesmo cachorro morto do servidor: a pagina renova o pedido a cada
    // 200 ms e o jog cai sozinho se parar de chegar renovacao. Aqui nao ha
    // Wi-Fi para cair, mas ha aba escondida e dedo que sai da tela sem
    // soltar, e o comportamento tem que ser o mesmo dos dois lados.
    if(agora() > est.jogAte){
      est.jog = null;
      avisar("jog interrompido: a pagina parou de responder");
      return;
    }

    const [eixo, sinal] = est.jog;
    const [novo, aviso] = aplicarJog(
      est.q, eixo, sinal, est.velocidade / 100, est.recurso, dt);
    if(aviso){
      est.jog = null;
      avisar(aviso);
      return;
    }
    est.q = novo;
  }

  function instantaneo(){
    const q = est.q;
    const corpos = transformadas(q);
    const c6 = corpos[6];
    const ponta = pontaDe(c6);
    // Colunas de (R6 @ FLANGE_R) sao os eixos da ferramenta no mundo, e e
    // isso que o aplicar3d() da pagina espera ler. Ou seja: a transposta,
    // escrita a mao. Era um flatMap, que so existe a partir do iOS 12 e
    // custava a pagina inteira num iPad velho por tres linhas de ganho.
    const f = mul3(c6.R, FLANGE_R);
    const eixosPonta = [f[0], f[3], f[6],
                        f[1], f[4], f[7],
                        f[2], f[5], f[8]];
    const pose = poseFlange(q);
    const sigma = menorSigma(jacobiano(q));

    let mensagem = agora() < est.mensagemAte ? est.mensagem : "";
    if(!mensagem){
      mensagem = sigma < LIMIAR_SINGULARIDADE
        ? `singularidade proxima (sigma ${sigma.toFixed(4)}), `
          + `o movimento cartesiano fica impreciso aqui`
        : "sem servidor: a cinematica roda neste navegador";
    }

    return {
      q: q.map(v => v * 180 / Math.PI),
      // Posicao em mm e orientacao em rad, que e como o controlador do UR
      // reporta. A pagina so imprime.
      pose: pose.slice(0, 3).map(v => v * 1000).concat(pose.slice(3)),
      ponta,
      eixos_ponta: eixosPonta,
      corpos: corpos.map(c => c.R.concat(c.t)),
      velocidade: est.velocidade,
      recurso: est.recurso,
      movendo: est.jog !== null,
      estado: est.jog !== null ? "simulacao: em movimento" : "simulacao: parado",
      mensagem,
      falha: false,
      sigma,
      espelho: false,
      comanda: false,
      robo: {
        modo: "simulacao", nivel: "neutro", rotulo: "SIMULACAO",
        detalhe: "nenhum robo envolvido: a pose sai da cinematica que roda "
               + "neste navegador, sem servidor e sem rede",
      },
    };
  }

  // O relogio faz o papel do laco do servidor e do fluxo SSE ao mesmo
  // tempo. Passo e quadro no mesmo ritmo: a pagina nunca viu diferenca.
  function escutar(aoReceber){
    ouvinte = aoReceber;
    if(relogio !== null) return;
    ultimo = agora();
    relogio = setInterval(() => {
      const t = agora();
      // dt medido, e nao PERIODO fixo: aba em segundo plano e iPad que
      // engasga fazem o setInterval atrasar, e com dt fixo o jog andaria
      // menos do que o dedo pediu. O teto de 0.2 s evita o salto grande
      // quando a aba volta de um congelamento longo.
      const dt = Math.min(t - ultimo, 0.2);
      ultimo = t;
      passo(dt);
      if(ouvinte) ouvinte(instantaneo());
    }, PERIODO * 1000);
  }

  function parar(){
    if(relogio !== null){ clearInterval(relogio); relogio = null; }
    ouvinte = null;
    est.jog = null;
  }

  return {
    config: () => Promise.resolve(configuracao()),
    comandar,
    escutar,
    parar,
    malha: (i) => `malha/${i}.bin`,
  };
}

window.criarLocal = criarLocal;

})();

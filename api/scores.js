export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({
    fetchedAt: new Date().toISOString(),
    standings: {
      A:[{team:'México',abbr:'MEX',w:3,d:0,l:0,pts:9,gp:6,gc:0},{team:'África do Sul',abbr:'RSA',w:1,d:1,l:1,pts:4,gp:2,gc:3},{team:'Coreia do Sul',abbr:'KOR',w:1,d:0,l:2,pts:3,gp:2,gc:3},{team:'Tchéquia',abbr:'CZE',w:0,d:1,l:2,pts:1,gp:2,gc:6}],
      B:[{team:'Suíça',abbr:'SUI',w:2,d:1,l:0,pts:7,gp:7,gc:3},{team:'Canadá',abbr:'CAN',w:1,d:1,l:1,pts:4,gp:8,gc:3},{team:'Bósnia',abbr:'BIH',w:1,d:1,l:1,pts:4,gp:5,gc:6},{team:'Catar',abbr:'QAT',w:0,d:1,l:2,pts:1,gp:2,gc:10}],
      C:[{team:'Brasil',abbr:'BRA',w:2,d:1,l:0,pts:7,gp:7,gc:1},{team:'Marrocos',abbr:'MAR',w:2,d:1,l:0,pts:7,gp:6,gc:3},{team:'Escócia',abbr:'SCO',w:1,d:0,l:2,pts:3,gp:1,gc:4},{team:'Haiti',abbr:'HTI',w:0,d:0,l:3,pts:0,gp:2,gc:8}],
      D:[{team:'Estados Unidos',abbr:'USA',w:2,d:0,l:1,pts:6,gp:8,gc:4},{team:'Austrália',abbr:'AUS',w:1,d:1,l:1,pts:4,gp:2,gc:2},{team:'Paraguai',abbr:'PAR',w:1,d:1,l:1,pts:4,gp:2,gc:4},{team:'Turquia',abbr:'TUR',w:1,d:0,l:2,pts:3,gp:3,gc:5}],
      E:[{team:'Alemanha',abbr:'GER',w:2,d:0,l:1,pts:6,gp:10,gc:4},{team:'C. Marfim',abbr:'CIV',w:2,d:0,l:1,pts:6,gp:4,gc:2},{team:'Equador',abbr:'ECU',w:1,d:1,l:1,pts:4,gp:2,gc:2},{team:'Curaçao',abbr:'CUW',w:0,d:1,l:2,pts:1,gp:1,gc:9}],
      F:[{team:'Holanda',abbr:'NED',w:2,d:1,l:0,pts:7,gp:10,gc:4},{team:'Japão',abbr:'JPN',w:1,d:2,l:0,pts:5,gp:7,gc:3},{team:'Suécia',abbr:'SWE',w:1,d:1,l:1,pts:4,gp:7,gc:7},{team:'Tunísia',abbr:'TUN',w:0,d:0,l:3,pts:0,gp:2,gc:12}],
      G:[{team:'Bélgica',abbr:'BEL',w:1,d:2,l:0,pts:5,gp:6,gc:2},{team:'Egito',abbr:'EGY',w:1,d:2,l:0,pts:5,gp:5,gc:3},{team:'Irã',abbr:'IRN',w:0,d:3,l:0,pts:3,gp:3,gc:3},{team:'Nova Zelândia',abbr:'NZL',w:0,d:1,l:2,pts:1,gp:4,gc:10}],
      H:[{team:'Espanha',abbr:'ESP',w:2,d:1,l:0,pts:7,gp:5,gc:0},{team:'Cabo Verde',abbr:'CPV',w:0,d:3,l:0,pts:3,gp:2,gc:2},{team:'Uruguai',abbr:'URU',w:0,d:2,l:1,pts:2,gp:3,gc:4},{team:'Ar. Saudita',abbr:'KSA',w:0,d:2,l:1,pts:2,gp:1,gc:5}],
      I:[{team:'França',abbr:'FRA',w:3,d:0,l:0,pts:9,gp:10,gc:2},{team:'Noruega',abbr:'NOR',w:2,d:0,l:1,pts:6,gp:8,gc:7},{team:'Senegal',abbr:'SEN',w:1,d:0,l:2,pts:3,gp:8,gc:6},{team:'Iraque',abbr:'IRQ',w:0,d:0,l:3,pts:0,gp:1,gc:12}],
      J:[{team:'Argentina',abbr:'ARG',w:3,d:0,l:0,pts:9,gp:8,gc:1},{team:'Áustria',abbr:'AUT',w:1,d:1,l:1,pts:4,gp:6,gc:6},{team:'Argélia',abbr:'DZA',w:1,d:1,l:1,pts:4,gp:5,gc:7},{team:'Jordânia',abbr:'JOR',w:0,d:0,l:3,pts:0,gp:3,gc:8}],
      K:[{team:'Colômbia',abbr:'COL',w:2,d:1,l:0,pts:7,gp:4,gc:1},{team:'Portugal',abbr:'POR',w:1,d:2,l:0,pts:5,gp:6,gc:1},{team:'Congo (RD)',abbr:'COD',w:1,d:1,l:1,pts:4,gp:4,gc:3},{team:'Uzbequistão',abbr:'UZB',w:0,d:0,l:3,pts:0,gp:2,gc:11}],
      L:[{team:'Inglaterra',abbr:'ENG',w:2,d:1,l:0,pts:7,gp:6,gc:2},{team:'Croácia',abbr:'CRO',w:2,d:0,l:1,pts:6,gp:5,gc:5},{team:'Gana',abbr:'GHA',w:1,d:1,l:1,pts:4,gp:2,gc:2},{team:'Panamá',abbr:'PAN',w:0,d:0,l:3,pts:0,gp:0,gc:4}]
    },
    scorers: [
      {name:'Erling Haaland',abbr:'NOR',team:'Noruega',goals:4},
      {name:'Kylian Mbappé',abbr:'FRA',team:'França',goals:4},
      {name:'Lamine Yamal',abbr:'ESP',team:'Espanha',goals:3},
      {name:'Lionel Messi',abbr:'ARG',team:'Argentina',goals:3},
      {name:'Harry Kane',abbr:'ENG',team:'Inglaterra',goals:3},
      {name:'Vinicius Jr.',abbr:'BRA',team:'Brasil',goals:3},
      {name:'Bukayo Saka',abbr:'ENG',team:'Inglaterra',goals:2},
      {name:'Romelu Lukaku',abbr:'BEL',team:'Bélgica',goals:2},
      {name:'Memphis Depay',abbr:'NED',team:'Holanda',goals:2},
      {name:'Olivier Giroud',abbr:'FRA',team:'França',goals:2}
    ],
    fixtures: []
  });
}

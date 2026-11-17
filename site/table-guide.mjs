export const tableGuide = {
  produtos_swift: {
    title: 'Produtos ativos',
    description: 'Reúne código, nome, disponibilidade, tipos e ocasiões de consumo de cada produto do catálogo.',
    importance: 'Define quais alimentos podem participar do atendimento e quais combinam com o perfil do cliente. A revisão do registro ajuda a impedir que uma edição sobrescreva uma alteração mais recente.',
    usage: 'O painel consulta e edita os produtos. As APIs dos dois jogos usam suas classificações para montar as opções de escolha e buscar os dados necessários à avaliação.',
  },
  produtos_swift_dados_originais: {
    title: 'Ficha detalhada dos produtos',
    description: 'Guarda marca, formato, unidade, família, fornecedor, preços, volumes, margem e classificações detalhadas de cada produto ativo.',
    importance: 'Mantém a ficha comercial completa para o administrador e fornece características que ajudam a entender o alimento. Preços e margens usam campos numéricos, com observações próprias para valores ausentes na origem.',
    usage: 'O painel mostra a ficha detalhada. O catálogo público usa marca, formato e unidade na apresentação dos produtos ao jogador. Cada ficha pertence a um produto de produtos_swift.',
  },
  produtos_swift_imagens: {
    title: 'Fotos dos produtos',
    description: 'Relaciona cada produto à sua foto no Cloudflare R2 e registra tamanho, dimensões, hashes, origem e indicação de foto manual.',
    importance: 'Permite mostrar a foto correta e verificar se a imagem mudou antes de publicar uma nova versão. A indicação de foto manual protege a escolha do administrador durante a sincronização automática.',
    usage: 'O jogo e o painel exibem a imagem indicada aqui. O robô atualiza seu vínculo após processar uma foto. O painel também usa esses dados quando o envio manual está habilitado. O arquivo da imagem fica no R2.',
  },
  sincronizacao_imagens_swift: {
    title: 'Controle da sincronização de fotos',
    description: 'Registra a última verificação do robô, o endereço consultado, o resultado e os identificadores de alteração da imagem.',
    importance: 'Dá ao robô uma referência da execução anterior para verificar mudanças e aproveitar respostas condicionais do site da Swift. Isso reduz transferências e reprocessamentos de imagens já verificadas.',
    usage: 'O robô diário consulta e atualiza esta tabela durante a busca de fotos. O identificador de origem conserva o estado da verificação mesmo quando o produto já foi arquivado.',
  },
  ranking: {
    title: 'Resultados dos jogadores',
    description: 'Guarda o resultado publicado por cada jogador, com nome, pontos, satisfação, qualidade, tempo e data de publicação.',
    importance: 'Permite compartilhar os resultados entre visitantes e ordenar a classificação por pontuação, usando o tempo como desempate. Os limites das colunas ajudam a recusar pontuações fora da faixa aceita.',
    usage: 'O jogador publica uma partida concluída pela API após entrar na conta. O jogo mostra a classificação e o painel consulta os resultados. O UID relaciona a publicação à conta do Firebase Authentication.',
  },
  auditoria_catalogo: {
    title: 'Histórico de alterações do catálogo',
    description: 'Registra quem editou um produto, quando a edição ocorreu e quais versões representam os estados anterior e posterior.',
    importance: 'Permite identificar a autoria de uma mudança e conferir exatamente o que foi alterado. A edição e seu histórico são gravados na mesma transação para manter essa correspondência.',
    usage: 'A API cria um registro quando o administrador salva uma edição. A aba Histórico de alterações do painel usa essas informações para comparar os valores anteriores e os novos.',
  },
  produtos_swift_versoes: {
    title: 'Versões históricas dos produtos',
    description: 'Guarda o nome, código, disponibilidade e classificações do produto no momento de uma edição ou de um arquivamento.',
    importance: 'Preserva o estado que existia em cada evento, mesmo que o produto ativo mude depois. Também fornece a base para recuperar um produto arquivado.',
    usage: 'A auditoria referencia duas versões, antes e depois da edição. O arquivo de produtos referencia a versão salva antes da remoção. Cada versão possui sua ficha detalhada e seus metadados de foto relacionados.',
  },
  versoes_produtos_dados_originais: {
    title: 'Fichas detalhadas das versões',
    description: 'Guarda a ficha comercial e as classificações detalhadas correspondentes a cada versão histórica de produto.',
    importance: 'Permite reconstruir o produto completo para comparação ou restauração. Alterações na ficha atual deixam de afetar os valores que pertencem a um evento anterior.',
    usage: 'A API consulta esta tabela ao reconstruir os estados antes e depois de uma edição e ao restaurar um produto arquivado. Cada registro pertence a uma versão de produtos_swift_versoes.',
  },
  versoes_produtos_imagens: {
    title: 'Fotos das versões históricas',
    description: 'Guarda o endereço, os hashes, as dimensões, a origem e os demais metadados da foto de uma versão histórica.',
    importance: 'Permite identificar a foto vinculada ao produto naquele momento e recuperar esse vínculo ao restaurar um registro arquivado. Preserva também a indicação de foto escolhida manualmente.',
    usage: 'A API reconstrói a imagem dos estados registrados na auditoria e dos produtos arquivados. Os arquivos são referenciados pelo endereço no R2, e versões sem foto podem ficar sem registro nesta tabela.',
  },
  arquivo_produtos_swift: {
    title: 'Produtos arquivados',
    description: 'Registra o motivo e a data da remoção de um produto, sua identificação original e a referência à versão completa preservada.',
    importance: 'Permite recuperar alimentos retirados durante a limpeza de duplicados ou a verificação de produtos ausentes no site da Swift. O motivo do arquivamento ajuda a entender por que o registro saiu do catálogo.',
    usage: 'O robô grava o arquivo e remove o produto ativo na mesma transação, verificando sua revisão. O serviço de restauração usa a versão preservada para recriar o produto e sua foto, recusando substituir um produto que já existe.',
  },
  products: {
    title: 'Catálogo público',
    description: 'View que reúne nome, código, disponibilidade, categorias, marca, formato, unidade e endereço da foto.',
    importance: 'Oferece uma consulta pronta para as opções do jogo e delimita os campos públicos apresentados nas fichas. As recomendações também filtram a disponibilidade e a validade da foto.',
    usage: 'A API consulta esta view para carregar o catálogo compartilhado pelos dois jogos e mantido em cache no Redis. Ela reúne produtos_swift, produtos_swift_dados_originais e produtos_swift_imagens.',
  },
};

// Sob carga (CI, várias suítes em paralelo) o padrão de 1 s do findBy/waitFor e o de 5 s por teste não bastam
// para os testes com user-event e para as rotas carregadas com React.lazy.
const { configure } = require('@testing-library/react')

configure({ asyncUtilTimeout: 10000 })

# Google Authenticator Web — TODO

## Backend
- [x] Schema: tabela `totp_accounts` (id, userId, name, secret, issuer, icon, createdAt)
- [x] Schema: tabela `app_sessions` para autenticação por senha
- [x] Procedure: `auth.passwordLogin` — valida senha e cria sessão JWT
- [x] Procedure: `auth.passwordLogout` — invalida sessão
- [x] Procedure: `auth.checkSession` — verifica sessão ativa
- [x] Procedure: `totp.list` — lista contas do usuário autenticado
- [x] Procedure: `totp.add` — adiciona conta com nome + chave secreta
- [x] Procedure: `totp.remove` — remove conta por ID
- [x] Procedure: `totp.generateCode` — gera código TOTP atual no servidor

## Frontend — Login
- [x] Tela de login com campo de senha e botão entrar
- [x] Visual elegante: fundo escuro, tipografia refinada
- [x] Feedback de erro em senha incorreta
- [x] Persistência de sessão no localStorage/cookie

## Frontend — Dashboard
- [x] Layout responsivo com sidebar ou header
- [x] Listagem de contas com nome, ícone e código TOTP
- [x] Contador regressivo de 30 segundos com barra de progresso
- [x] Atualização automática dos códigos a cada 30 segundos
- [x] Botão de copiar código com feedback visual
- [x] Botão de remover conta com confirmação

## Frontend — Adicionar Conta
- [x] Modal/drawer para adicionar conta
- [x] Aba: scanner de QR code via câmera
- [x] Aba: inserção manual (nome + chave secreta)
- [x] Validação de chave secreta Base32
- [x] Feedback de sucesso ao adicionar

## Estilo Visual
- [x] Tema escuro elegante (dark mode como padrão)
- [x] Tipografia refinada (Inter ou similar)
- [x] Animações suaves nas interações
- [x] Design responsivo mobile-first
- [x] Ícones de serviços populares (Google, GitHub, etc.)

## Importação do Google Authenticator
- [x] Suporte ao formato otpauth-migration:// (exportação do Google Authenticator)
- [x] Parser manual de protobuf para decodificar dados de exportação
- [x] Importação em lote: selecionar/desmarcar contas individualmente
- [x] Compatibilidade com QR codes padrão otpauth://totp/ e formato de migração

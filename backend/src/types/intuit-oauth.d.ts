declare module 'intuit-oauth' {
  export interface Token {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in?: number;
    x_refresh_token_expires_in?: number;
    realmId?: string;
    scope?: string | string[];
  }

  export interface AuthResponse {
    getJson(): Token;
  }

  export interface OAuthClientOptions {
    clientId: string;
    clientSecret: string;
    environment: 'sandbox' | 'production';
    redirectUri: string;
  }

  export interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }

  class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
      Intuit_name: string;
    };

    constructor(options: OAuthClientOptions);

    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(url: string): Promise<AuthResponse>;
    getToken(): Token;
    setToken(token: Partial<Token>): void;
    refresh(): Promise<AuthResponse>;
    revoke(params: { access_token: string }): Promise<void>;
  }

  export default OAuthClient;
}

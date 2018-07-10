import {
    DefaultUriUrlRequestApi, Request, CoreOptions, OptionalUriUrl, RequestAPI, RequiredUriUrl, Response,
    defaults as defaultRequest, jar as requestJar
} from 'request';
import { createHash } from 'crypto';

import { RetsServerError, RetsProcessingError } from '../utils/errors';
import { IRetsResponse, IRetsResponseBody } from './IRetsResponse';
import { IClientConfiguration } from './IClientConfiguration';
import { parseRetsResponse } from '../utils/parseRetsResponse';
import { RetsRequestMethod } from './RetsRequestMethod';
import { processHeaders } from '../utils/processHeaders';
import { replaceAddress } from '../utils/replaceAddress';
import { RetsVersion } from './RETSVersion';
import { RetsAction } from './RetsAction';

export class RetsSession {
    public readonly configuration: IClientConfiguration;
    public readonly actions: { [key: string]: DefaultUriUrlRequestApi<Request, CoreOptions, OptionalUriUrl> } = {};
    private session: RequestAPI<Request, CoreOptions, RequiredUriUrl>;

    public constructor(configuration: IClientConfiguration) {
        this.configuration = configuration;
        this.session = defaultRequest({
            jar: requestJar(),
            headers: this.createHeader(),
            method: this.configuration.method || 'GET',
            auth: {
                user: this.configuration.username,
                pass: this.configuration.password,
                sendImmediately: false
            },
            timeout: this.configuration.timeout,
            proxy: this.configuration.proxyUrl,
            tunnel: this.configuration.useTunnel
        });
        this.actions[RetsAction.Login] = this.session.defaults({ uri: this.configuration.url });
    }

    public async login(): Promise<void> {
        const response = await this.sendAction(RetsAction.Login, {}).catch((e: Error | IRetsResponse) => e);
        if (response instanceof Error) { throw response; }
        if (response.headers.setCookie) {
            const cookies = ([] as string[]).concat(response.headers.SetCookie);
            for (let i = -1; ++i < cookies.length;) {
                const matches = cookies[i].match(/RETS\-Session\-ID=([^;]+);/);
                if (matches) {
                    this.configuration.sessionId = matches[i];
                    break;
                }
            }
        }
        if (response.headers.RETSVersion) {
            this.configuration.version =
                (response.headers.RETSVersion instanceof Array ? response.headers.RETSVersion[0] : response.headers.RETSVersion) as RetsVersion;
        }
        this.session = this.session.defaults({ headers: this.createHeader() }); // 更新Header
        this.actions[RetsAction.Login] = this.session.defaults({ uri: this.configuration.url });
        const source = response.body.extra.content;
        if (!source) {
            throw new RetsProcessingError(new ReferenceError('Could not find URL information after login'));
        }
        source.split('\r\n').filter(v => v.indexOf('=') > -1).map(v => v.split('=')).forEach(url => {
            const [name, address] = url;
            let action: RetsAction | undefined;
            switch (name) {
                case 'GetObject':
                    action = RetsAction.GetObject;
                    break;
                case 'Logout':
                    action = RetsAction.Logout;
                    break;
                case 'Search':
                    action = RetsAction.Search;
                    break;
            }
            if (action) {
                this.actions[action] = this.session.defaults({ uri: replaceAddress(address, this.configuration.url) });
            }
        });
    }

    public async logout(): Promise<void> {
        const response = await this.sendAction(RetsAction.Logout, {}).catch((e: Error | IRetsResponse) => e);
        if (response instanceof Error) { throw response; }
        delete this.actions[RetsAction.GetObject];
        delete this.actions[RetsAction.Logout];
        delete this.actions[RetsAction.Search];
    }

    public async search(options: IRetsQueryOptions): Promise<IRetsResponseBody> {

    }

    private createHeader(): { [key: string]: string } {
        const headers: { [key: string]: string } = {};
        headers['User-Agent'] = this.configuration.userAgent || 'RETS NodeJS-Client/5.x';
        headers['RETS-Version'] = this.configuration.version;
        if (this.configuration.userAgentPassword) {
            headers['RETS-UA-Authorization'] = 'Digest ' + createHash('md5').update([
                createHash('md5').update(`${this.configuration.userAgent}:${this.configuration.userAgentPassword}`).digest('hex'),
                '',
                this.configuration.sessionId || '',
                headers['RETS-Version']
            ].join(':')).digest('hex');
        }
        return headers;
    }

    private async sendAction(action: RetsAction, query: any): Promise<IRetsResponse> {
        const data = await new Promise<{ response: Response, body: any }>((resolve, reject) =>
            this.actions[action](
                { [this.configuration.method === RetsRequestMethod.POST ? 'form' : 'qs']: query },
                (e, r, b) => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve({ response: r, body: b });
                    }
                })
        ).catch((e: Error) => e);
        if (data instanceof Error) { throw data; }
        if (data.response.statusCode !== 200) {
            throw new RetsServerError(data.response.statusCode, data.response.statusMessage);
        } else {
            const response = {
                headers: processHeaders(data.response.rawHeaders),
                body: await parseRetsResponse(data.body).catch((e: Error) => e),
                response: data.response
            };
            if (response.body instanceof Error) { throw response.body; }
            return response as IRetsResponse;
        }
    }
}

if @urls[URL_KEYS.SEARCH]
@search = search(@baseRetsSession.defaults(uri: @urls[URL_KEYS.SEARCH]), @)
      else
hasPermissions = false
missingPermissions.push URL_KEYS.SEARCH
if @urls[URL_KEYS.GET_OBJECT]
@objects = object(@baseRetsSession.defaults(uri: @urls[URL_KEYS.GET_OBJECT]), @)
@logoutRequest = Promise.promisify(@baseRetsSession.defaults(uri: @urls[URL_KEYS.LOGOUT]))
if !hasPermissions
        throw new errors.RetsPermissionError(missingPermissions)

return @
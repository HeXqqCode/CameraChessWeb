import { AccessContext, OAuth2AuthCodePKCE } from '@bity/oauth2-auth-code-pkce';
import { userReset, userSetToken, userSetUsername } from '../slices/userSlice';
import { Dispatch } from 'react';
import { AnyAction } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { Study } from '../types';

const lichessHost = 'https://lichess.org';
const scopes = ["study:write", "study:read"];
const clientId = 'lichess-api-demo';
const clientUrl = `${location.protocol}//${location.host}/`;

const getOauth = () => {
  const oauth: OAuth2AuthCodePKCE = new OAuth2AuthCodePKCE({
    authorizationUrl: `${lichessHost}/oauth`,
    tokenUrl: `${lichessHost}/api/token`,
    clientId,
    scopes,
    redirectUrl: clientUrl,
    onAccessTokenExpiry: refreshAccessToken => refreshAccessToken(),
    onInvalidGrant: console.warn,
  });
  return oauth
}

const readStream = (processLine: any) => (response: any) => {
  const stream = response.body.getReader();
  const matcher = /\r?\n/;
  const decoder = new TextDecoder();
  let buf: any = '';

  const loop = () =>
    stream.read().then(({ done, value }: {done: boolean, value: any}) => {
      if (done) {
        if (buf.length > 0) processLine(JSON.parse(buf));
      } else {
        const chunk = decoder.decode(value, {
          stream: true
        });
        buf += chunk;

        const parts = buf.split(matcher);
        buf = parts.pop();
        for (const i of parts.filter((p: any) => p)) processLine(JSON.parse(i));
        return loop();
      }
    });

  return loop();
}

const fetchBody = async (token: string, path: string, options: any = {}) => {
  const res: any = await fetchResponse(token, path, options);
  const body: any = await res.json();
  return body;
}

const fetchResponse = async (token: string, path: string, options: any = {}) => {
  const config: any = {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
  const res: any = await window.fetch(`${lichessHost}${path}`, config);
  if (!res.ok) {
    const err = `${res.status} ${res.statusText}`;
    alert(err);
    throw err;
  }
  return res;
};

export const lichessLogin = () => {
  const oauth = getOauth();
  oauth.fetchAuthorizationCode();
}

export const lichessLogout = (dispatch: Dispatch<AnyAction>) => {
  localStorage.removeItem("oauth2authcodepkce-state");
  dispatch(userReset());
}

export const lichessGetAccount = (token: string) => {
  const path = "/api/account";
  const account = fetchBody(token, path);
  return account;
}

export const lichessSetStudies = async (token: string, username: string, setStudies: any) => {
  const path = `/api/study/by/${username}`;

  const studies: Study[] = [];
  fetchResponse(token, path)
  .then(readStream(async (response: any) => {
    studies.push({
      "id": response.id, 
      "name": response.name
    });
  }))
  .then(() => setStudies(studies));
}

export const lichessSetBroadcasts = (token: string, setStudies: any) => {
  const path = `/api/broadcast/my-rounds`;
  const studies: Study[] = [];
  fetchResponse(token, path)
  .then(readStream(async (response: any) => {
    studies.push({
      "id": response.round.id, 
      "name": response.round.name
    });
  }))
  .then(() => setStudies(studies));
}

export const lichessImportPgn = (token: string, pgn: string) => {
  const path = "/api/import";
  const options = {
    body: new URLSearchParams({ pgn }), 
    method: "POST"
  };
  const data = fetchBody(token, path, options);
  return data
}

export const lichessImportPgnToStudy = (token: string, pgn: string, name: string, studyId: string) => {
  const path = `/api/study/${studyId}/import-pgn`;
  const options = {
    body: new URLSearchParams({ pgn: pgn, name: name }), 
    method: "POST"
  };
  fetchResponse(token, path, options);
}

export const lichessPushRound = (token: string, pgn: string, roundId: string) => {
  const path = `/api/broadcast/round/${roundId}/push`;
  const options = {
    body: pgn,
    method: "POST"
  }
  fetchResponse(token, path, options);
}


export const lichessTrySetUser = async (navigate: NavigateFunction, dispatch: Dispatch<AnyAction>) => {
  const oauth: OAuth2AuthCodePKCE = getOauth();
  const returning: boolean = await oauth.isReturningFromAuthServer();
  if (!returning) {
    return;
  }

  const accessContext: AccessContext = await oauth.getAccessToken();
  const newToken: string | undefined = accessContext?.token?.value;
  if (newToken === undefined) {
    console.log("Access Context token is undefined");
    return;
  }
  
  dispatch(userSetToken(newToken));

  const account: any = await lichessGetAccount(newToken);
  const username: string = account.username;
  dispatch(userSetUsername(username))
  
  navigate("/");
}
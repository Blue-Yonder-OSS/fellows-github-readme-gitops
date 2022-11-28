import {Octokit} from "@octokit/rest";
import * as core from '@actions/core';
import {throttling} from '@octokit/plugin-throttling'
import logger from "./logger";
import {getGitHubCredentials} from "./credentials";
import {retry} from "@octokit/plugin-retry";
import { OctokitOptions } from "@octokit/core/dist-types/types";
const abuseLimitRetries = 20
const rateLimitRetries = 20
const resilientOctokit = Octokit.plugin(throttling, retry)
const getOctokit = (
    userToken = getGitHubCredentials()) => {
    if (!userToken) {
        logger.error('Missing credentials');
        return Promise.reject("Missing credentials");
    }

    const options:OctokitOptions={
        auth: userToken,
        log: logger,
        throttle: {
            onRateLimit: (retryAfter, options) => {
                octokit.log.warn(
                    `Request quota exhausted for request ${options.method} ${options.url} retrying after ${retryAfter} seconds retry count ${options.request.retryCount}/${rateLimitRetries}`
                );

                // Retry twice after hitting a rate limit error, then give up
                if (options.request.retryCount <= rateLimitRetries) {
                    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
                octokit.log.warn(`Did not retry request ${options.method} ${options.url}`);
                return false;
            },
            onAbuseLimit: (retryAfter, options) => {
                // does not retry, only logs a warning
                octokit.log.warn(
                    `Abuse detected for request ${options.method} ${options.url} retrying after ${retryAfter} seconds retry count ${options.request.retryCount}/${abuseLimitRetries}`
                );
                if (options.request.retryCount <= abuseLimitRetries) {
                    octokit.log.warn(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
                octokit.log.warn(`Did not retry request ${options.method} ${options.url}`);
                return false;
            },
        },
        id: "by-gh"
    };
    const octokit = new resilientOctokit(options);

    return octokit;
};

const getAutenticatedUser = async () => {
    const octokit = <Octokit>getOctokit();
    return (await octokit.users.getAuthenticated()).data;
}
export {getOctokit, getAutenticatedUser};

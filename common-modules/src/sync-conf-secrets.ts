import {Command} from 'commander'
import logger from "./logger"
import {promises as fspromises, promises as fs} from "fs";
import * as path from "path"
import * as core from '@actions/core';

import {
    addRepoToSecret,
    getOrgRepos,
    getOrgSecretAssignedRepos,
    getOrgSecrets,
    orgReposIDs,
    setReposToSecret
} from "./org"
import {DEFAULT_SECRETS_FILE_PATH, DEFAULT_SECRETS_TEAMS_FILE_PATH} from "./constants"

const SECRET_FILES_PATH = process.env.SECRET_FILES_PATH || DEFAULT_SECRETS_FILE_PATH;
const SECRET_TEAMS_FILES_PATH = process.env.SECRETS_TEAMS_FILE_PATH || DEFAULT_SECRETS_TEAMS_FILE_PATH;
const trim = (value) => value.trim();
const secretsMappingFilesSubpath = 'secrets';

interface TeamSecretsMapping {
    fileName: string;
    secrets: string[];
}

const processFilesChanges = async (filesChanged: string[], foundCurrentTeamsSecrets: { [index: string]: TeamSecretsMapping } , orgRepos, orgName) => {
    let response;
    if (filesChanged?.length) {
        response = await filesChanged.reduce(async (currentRunPromise,fileChanged) => {
            const baseFilename = path.basename(fileChanged);
            logger.debug(`Processing file ${fileChanged}`);
            const currentRun = await currentRunPromise;
            const teamSecretSetChanged = Object.values(foundCurrentTeamsSecrets).find((currentTeamsSecrets) => currentTeamsSecrets.fileName === baseFilename)
            if (teamSecretSetChanged) {
                const secrets = JSON.parse(await fs.readFile(fileChanged, 'utf8'));
                return Promise.all((secrets || []).map(async ({name, repos}) => {
                    const response=await setReposToSecret(orgName, name, repos.map((repoName)=>{
                        const repoId = orgRepos[repoName];
                        if (!repoId) {
                            const errorMsg = `On file ${fileChanged} repo name ${repoName} assigned to secret ${name} is not valid and remove it if needed.`;
                            core.error(`Error ${errorMsg}`);
                            logger.error(errorMsg);
                            Promise.reject(errorMsg)
                        }
                        return repoId;
                    }))
                    return response;
                }))
            }
            return null;
        }, Promise.resolve({}));
    }
    return response;
}

const syncOrgSecrets = async () => {
    if (process.env.NODE_ENV === 'CI') {
        logger.level = "info";
    }
    console.debug(`Starting syncOrgSecrets`);
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name', trim)
    program.option('-d, --dryRun', 'Team "Everyone" slug')
    program.option('-g, --generateFiles', 'Generate teams\' secret mapping files')
    program.option('-f, --filesChanged <type...>', 'Teamset mapping file changed')
    program.parse(process.argv);
    const options = program.opts();
    const {orgName, dryRun, generateFiles, filesChanged: filesChanged} = options;

    let secrets;
    let orgRepos
    if (orgName) {
        try {
            orgRepos = (await orgReposIDs(orgName));
            secrets = await getOrgSecrets(options.orgName);
       //     logger.debug(`Secrets: \n ${JSON.stringify(secrets, null, 2)}`)
        } catch (error) {
            const errMsg=`Error getting secrets: \n ${JSON.stringify(error, null, 2)}`;
            core.error(`Error ${errMsg}`);
            logger.error(errMsg);
            throw  error;
        }

        const definedSecretsTeamsets = JSON.parse((await fspromises.readFile(SECRET_FILES_PATH)).toString());
        logger.debug(`File read mapping ${JSON.stringify(definedSecretsTeamsets, null, 2)}`);
        let foundCurrentTeamsSecrets: { [index: string]: TeamSecretsMapping } = await secrets.reduce(async (currentTeamsSecrets, currentSecret) => {
            const foundTeamSecretDefinition = definedSecretsTeamsets.find(currentTeamSecretDefinition => {
                    const foundTeamSecretDefinition = currentTeamSecretDefinition.namePatterns.some(currentPattern => {
                        const found = new RegExp(currentPattern).test(currentSecret.name);
                        return found;
                    });
                    return foundTeamSecretDefinition;
                }
            )
            if (currentSecret && foundTeamSecretDefinition) {
                const {name: secretName, visibility} = currentSecret;
                const currentOwningTeam = (await currentTeamsSecrets)[foundTeamSecretDefinition.teamName] = {...((await currentTeamsSecrets)[foundTeamSecretDefinition.teamName] || foundTeamSecretDefinition)};
                const secretRepos = await getOrgSecretAssignedRepos(orgName, secretName);
                if (visibility === "selected") {
                    currentOwningTeam.secrets = [...currentOwningTeam.secrets || [], {
                        name: secretName,
                        repos: secretRepos.map(repo => repo.name)
                    }];
                }
            }
            return currentTeamsSecrets;
        }, Promise.resolve({}));
        logger.debug(`teamSecrets mapping:\n***********************************\n
                            Secrets: \n ${JSON.stringify(foundCurrentTeamsSecrets, null, 2)}`);
        if (generateFiles) {
            await Promise.all(Object.values(foundCurrentTeamsSecrets).map((value) => {
                logger.info(`${JSON.stringify(value)}`);
                return fs.writeFile(`${SECRET_TEAMS_FILES_PATH}/${value.fileName}`, JSON.stringify(value.secrets, null, 2))
            }));
        }
        return await processFilesChanges(filesChanged, foundCurrentTeamsSecrets, orgRepos, orgName);
/*

        if (filesChanged.length) {
            const baseFilename = path.basename(filesChanged);
            const teamSecretSetChanged = Object.values(foundCurrentTeamsSecrets).find((currentTeamsSecrets) => currentTeamsSecrets.fileName === baseFilename)
            if (teamSecretSetChanged) {
                const fileContent = JSON.parse(await fs.readFile(filesChanged, 'utf8'));
                const delta = diff(teamSecretSetChanged.secrets, fileContent);
                logger.info(`delta=${JSON.stringify(delta, null, 2)}`);
                await Promise.all((delta || []).map((currentChange) => {
                    if (currentChange.kind == 'A') {
                        const secretChanged = fileContent[currentChange.path[0]];
                        const secretChangedName = secretChanged.name;
                        const repoItemChange = currentChange.item;
                        if (repoItemChange.kind == 'N') {
                            const repoAdded = repoItemChange.rhs;
                            logger.info(`Repo ${repoAdded} added to secret ${secretChangedName}`);
                            const repoId = orgRepos[repoAdded];
                            if (repoId) {
                                return addRepoToSecret(orgName, secretChangedName, repoId);
                            }
                        }
                    }
                    return null;
                }))
            }
        }
*/
    }

};

export {syncOrgSecrets}
const run = async () => {
    try {
        await syncOrgSecrets();
        console.info("Success.")
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
run()



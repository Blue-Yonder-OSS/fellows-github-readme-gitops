import * as chai from "chai";
import * as chaiSubset from "chai-subset";

import {getRepo, getReposForOrg, createCuratedRepo, deleteRepo} from "../../src";
import {createTeam, deleteTeam} from "../../src";
import {GitHubTeamPostfix} from "../../src/types";
import * as sampleRepo from "../fixtures/repo.json";
import {v4 as uuidv4} from "uuid";

describe("Repos", function () {
    const expect = chai.expect;
    const orgName = "ACME-Product-Development";
    const repoPrefix = "plat-mui-test-repo-unit-test-";
    const teamPrefix = "Platform MUI Unit Test Mock Team ";

    chai.use(chaiSubset);
    this.timeout(10000);
    before(async function () {
        const repos = (await getReposForOrg(orgName))
            .filter(repo => repo.name.startsWith(repoPrefix))
            .map(async (repo) => await deleteRepo({org: orgName, name: repo.name}));
    });

    it("gets all the repos from GitHub", async () => {
        const repos = await getReposForOrg(orgName);
        console.log(repos);
        expect(repos).to.containSubset([sampleRepo]);
        expect(repos.length).to.be.at.least(100);
    });

    it("gets repo's details", async () => {
        const repoName = "plat-mui-infrastructure";
        const repo = await getRepo(orgName, repoName);
        expect(repo).to.containSubset(sampleRepo);
    });
    describe("Create repos", function () {
        const mockRepoName = `${repoPrefix}-${uuidv4()}`;
        let contributorsMockTeamName, adminsTeamSlug, collaboratorsTeamSlug, contributorsTeamSlug;
        before(async () => {
            adminsTeamSlug = (
                await createTeam({
                    name: `${teamPrefix} ${uuidv4()} ${GitHubTeamPostfix.ADMINS}`,
                    org: orgName,
                    description: `Unit test ${GitHubTeamPostfix.ADMINS} team for repo creation`,
                })
            ).slug;
            collaboratorsTeamSlug = (
                await createTeam({
                    name: `${teamPrefix} ${uuidv4()} ${GitHubTeamPostfix.COLLABORATORS}`,
                    org: orgName,
                    description: `Unit test ${GitHubTeamPostfix.COLLABORATORS} team for repo creation`,
                })
            ).slug;
            contributorsTeamSlug = (
                await createTeam({
                    name: `${teamPrefix} ${uuidv4()} ${GitHubTeamPostfix.CONTRIBUTORS}`,
                    org: orgName,
                    description: `Unit test ${GitHubTeamPostfix.CONTRIBUTORS} team for repo creation`,
                })
            ).slug;
        });
        after(async () => {
            if (adminsTeamSlug) {
                await deleteTeam({org: orgName, slug: adminsTeamSlug});
            }
            if (collaboratorsTeamSlug) {
                await deleteTeam({org: orgName, slug: collaboratorsTeamSlug});
            }
            if (contributorsTeamSlug) {
                await deleteTeam({org: orgName, slug: contributorsTeamSlug});
            }
        });
        it("creates curated repo", async () => {
            const curatedRepo = await createCuratedRepo({
                org: orgName,
                description: `Unit test for repo ${mockRepoName}`,
                name: mockRepoName,
                teams: {
                    admins: adminsTeamSlug,
                    collaborators: collaboratorsTeamSlug,
                    contributors: contributorsMockTeamName,
                },
            });
            console.log(curatedRepo);
            expect(curatedRepo).to.be.not.null;
        });
    });
});

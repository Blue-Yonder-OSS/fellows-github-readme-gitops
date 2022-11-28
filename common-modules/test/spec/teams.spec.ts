import * as chai from "chai";
import * as chaiSubset from "chai-subset";
import chaiHttp = require("chai-http");
import { v4 as uuidv4 } from "uuid";

import { createTeam, deleteTeam } from "../../src";

describe("Teams", function () {
    const expect = chai.expect;
    const orgName = "JDA-Product-Development";
    const teamPrefix = "plat-lui-test-team-unit-test-";

    chai.use(chaiSubset);
    chai.use(chaiHttp);
    describe("Create Teams", function () {
        const mockTeamName = `${teamPrefix}-${uuidv4()}`;
        let teamSlug;
        after(async () => {
            if (teamSlug) {
                await deleteTeam({org:orgName, slug:teamSlug});
            }
        });
        it("Creates a new team", async () => {
            const team = await createTeam({
                description: `Test mock team name ${mockTeamName}`,
                maintainers: undefined,
                org: orgName,
                name: mockTeamName,
            });
            teamSlug = team.slug;
            console.log(team);
            expect(team).to.be.not.null;
        });
    });

    describe("Delete Teams", function () {
        const mockTeamName = `${teamPrefix}-${uuidv4()}`;
        let teamSlug;
        before(async () => {
            teamSlug = (
                await createTeam({
                    description: `Test delete mock team name ${mockTeamName}`,
                    maintainers: undefined,
                    org: orgName,
                    name: mockTeamName,
                })
            )?.slug;
        });
        it("Delete a team", async () => {
            const teamDeleteResponse = await deleteTeam({org:orgName, slug:teamSlug});
            console.log(teamDeleteResponse);
            expect(teamDeleteResponse).to.have.status(204);
        });
    });
});

# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::UserSearchIndexExtension do
  describe 'reindexing the account when the validation state changes' do
    # Mirror production: sign-ups await manual approval. In the suite's default
    # open mode, set_approved would force `approved: true` at creation.
    before { Setting.registrations_mode = 'approved' }

    let(:account) { user.account }

    def search_hits
      AccountsIndex.filter(term: { username: account.username })
    end

    context 'when a moderator approves a user with a confirmed email' do
      let(:user) { Fabricate(:user) }

      it 'adds the account to the index' do
        expect { user.approve! }.to change(search_hits, :count).from(0).to(1)
      end
    end

    context 'when an approved user confirms their email' do
      let(:user) { Fabricate(:user, confirmed_at: nil) }

      before { user.update!(approved: true) }

      it 'adds the account to the index' do
        expect { user.confirm }.to change(search_hits, :count).from(0).to(1)
      end
    end

    context 'when a user confirms their email but still awaits approval' do
      let(:user) { Fabricate(:user, confirmed_at: nil) }

      it 'keeps the account out of the index' do
        expect { user.confirm }.to_not change(search_hits, :count).from(0)
      end
    end
  end
end

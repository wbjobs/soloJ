using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Grpc.Core;
using CollisionService;
using DamageArbiter;
using StateService;

namespace MMORPG.Network
{
    public class GameClient
    {
        private readonly Channel stateChannel;
        private readonly Channel collisionChannel;
        private readonly Channel damageChannel;

        private readonly StateService.StateServiceClient stateClient;
        private readonly CollisionService.CollisionService.CollisionServiceClient collisionClient;
        private readonly DamageArbiter.DamageArbiter.DamageArbiterClient damageClient;

        private AsyncDuplexStreamingCall<StateUpdate, StateSnapshot> stateStream;
        private CancellationTokenSource cts;

        public event Action<StateSnapshot> OnStateSnapshot;

        public GameClient(string stateAddr, string collisionAddr, string damageAddr)
        {
            stateChannel = new Channel(stateAddr, ChannelCredentials.Insecure);
            collisionChannel = new Channel(collisionAddr, ChannelCredentials.Insecure);
            damageChannel = new Channel(damageAddr, ChannelCredentials.Insecure);

            stateClient = new StateService.StateServiceClient(stateChannel);
            collisionClient = new CollisionService.CollisionService.CollisionServiceClient(collisionChannel);
            damageClient = new DamageArbiter.DamageArbiter.DamageArbiterClient(damageChannel);

            cts = new CancellationTokenSource();
        }

        public async Task<PlayerOnlineResponse> PlayerOnline(string playerId, float x, float y, float z, float hp, float maxHp, int teamId, float attackPower, float defense, float critRate, float dodgeRate)
        {
            return await stateClient.PlayerOnlineAsync(new PlayerOnlineRequest
            {
                PlayerId = playerId,
                PositionX = x,
                PositionY = y,
                PositionZ = z,
                Hp = (int)hp,
                MaxHp = (int)maxHp,
                TeamId = teamId,
                AttackPower = attackPower,
                Defense = defense,
                CritRate = critRate,
                DodgeRate = dodgeRate
            });
        }

        public async Task StartStateStream(string playerId)
        {
            stateStream = stateClient.SubscribeState();

            _ = Task.Run(async () =>
            {
                while (await stateStream.ResponseStream.MoveNext(cts.Token))
                {
                    OnStateSnapshot?.Invoke(stateStream.ResponseStream.Current);
                }
            }, cts.Token);
        }

        public async Task<CollisionResponse> CheckCollision(CollisionRequest request)
        {
            return await collisionClient.CheckCollisionAsync(request);
        }

        public async Task<DamageResponse> ArbitrateDamage(DamageRequest request)
        {
            return await damageClient.ArbitrateDamageAsync(request);
        }

        public async Task<UpdatePositionResponse> UpdatePosition(string playerId, float x, float y, float z, float heading)
        {
            return await stateClient.UpdatePositionAsync(new UpdatePositionRequest
            {
                PlayerId = playerId,
                X = x,
                Y = y,
                Z = z,
                Heading = heading
            });
        }

        public async Task Shutdown()
        {
            cts.Cancel();

            if (stateStream != null)
            {
                await stateStream.RequestStream.CompleteAsync();
                stateStream.Dispose();
            }

            await stateChannel.ShutdownAsync();
            await collisionChannel.ShutdownAsync();
            await damageChannel.ShutdownAsync();
        }
    }
}
